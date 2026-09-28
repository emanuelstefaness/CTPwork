import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TIPO_USUARIO } from "@/lib/constants";
import { PERMISSOES, lerPermissoes, pode, perfilPadrao, type Acesso, type Permissao } from "@/lib/permissoes";

export class AcessoNegadoError extends Error {
  constructor(msg = "Acesso negado") {
    super(msg);
    this.name = "AcessoNegadoError";
  }
}

/**
 * O cookie de sessão (JWT) guarda o id do usuário no momento do login e nunca é revalidado
 * contra o banco pelo NextAuth. Se o usuário por trás daquele id deixar de existir (ex.: banco
 * resetado/reaplicado durante o desenvolvimento), qualquer ação de escrita que use esse id como
 * chave estrangeira (autorId, criadoPorId, etc.) quebra com erro de foreign key do Prisma em vez
 * de pedir login novamente. SessaoInvalidaError existe para dar uma mensagem clara + saída (login)
 * nesse caso, em vez de vazar o erro cru do banco para a tela.
 */
export class SessaoInvalidaError extends Error {
  constructor(msg = "Sua sessão expirou ou não é mais válida. Faça login novamente.") {
    super(msg);
    this.name = "SessaoInvalidaError";
  }
}

export type SessaoAtual = {
  id: string;
  name?: string | null;
  email?: string | null;
  tipo: string;
  perfilInterno: string | null;
  setorId: string | null;
  municipioId: string | null;
} & Acesso;

type Carregada = { sessao: SessaoAtual } | { invalida: "inexistente" | "desativado" } | null;

/**
 * Sessão da requisição, lida do banco a cada request (uma vez só, graças ao `cache`): perfil,
 * permissões, tipo e município valem na hora em que o gestor os muda — o JWT só identifica a pessoa.
 */
const carregarSessao = cache(async (): Promise<Carregada> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, nome: true, email: true, tipo: true, perfilInterno: true, setorId: true, municipioId: true, ativo: true,
      perfil: { select: { id: true, nome: true, tipo: true, permissoes: true, somenteParticipa: true } },
    },
  });
  if (!u) return { invalida: "inexistente" };
  if (!u.ativo) return { invalida: "desativado" };

  // Sem perfil (ou com perfil de outro tipo): cai no perfil de fábrica do seu tipo.
  const perfil = u.perfil && u.perfil.tipo === u.tipo
    ? u.perfil
    : await prisma.perfil.findUnique({ where: { id: perfilPadrao(u) }, select: { id: true, nome: true, tipo: true, permissoes: true, somenteParticipa: true } });

  return {
    sessao: {
      id: u.id,
      name: u.nome,
      email: u.email,
      tipo: u.tipo,
      perfilInterno: u.perfilInterno,
      setorId: u.setorId,
      municipioId: u.municipioId,
      perfilId: perfil?.id ?? perfilPadrao(u),
      perfilNome: perfil?.nome ?? (u.tipo === "EXTERNO" ? "Município" : "Colaborador"),
      permissoes: lerPermissoes(perfil?.permissoes, u.tipo),
      somenteParticipa: u.tipo === "INTERNO" && !!perfil?.somenteParticipa,
    },
  };
});

/** Sessão do cookie, só se o usuário existir e estiver ativo — nunca lança, usada em páginas/layouts que preferem redirect a erro. */
export async function sessaoValidaOuNula(): Promise<SessaoAtual | null> {
  const r = await carregarSessao();
  // Usuário desativado cai aqui também: o layout manda para /api/sair-sessao-invalida, que apaga o cookie.
  return r && "sessao" in r ? r.sessao : null;
}

/** Exige sessão autenticada e válida (usuário do cookie existe e está ativo). */
export async function requireSession(): Promise<SessaoAtual> {
  const r = await carregarSessao();
  if (!r) throw new AcessoNegadoError("Não autenticado");
  if ("invalida" in r) {
    throw new SessaoInvalidaError(r.invalida === "desativado" ? "Seu acesso foi desativado. Fale com a equipe do CTP." : undefined);
  }
  return r.sessao;
}

/** Exige usuário interno (CTP). Memorandos e telas administrativas nunca são vistos por externos. */
export async function requireInterno(): Promise<SessaoAtual> {
  const user = await requireSession();
  if (user.tipo !== TIPO_USUARIO.INTERNO) throw new AcessoNegadoError("Restrito a usuários CTP");
  return user;
}

/** Exige uma permissão do perfil (Cadastros › Perfis). */
export async function exigirPermissao(permissao: Permissao): Promise<SessaoAtual> {
  const user = await requireSession();
  exigir(user, permissao);
  return user;
}

export function exigir(user: SessaoAtual, permissao: Permissao) {
  if (!pode(user, permissao)) {
    throw new AcessoNegadoError(`Seu perfil (${user.perfilNome}) não permite: ${PERMISSOES[permissao].rotulo.toLowerCase()}.`);
  }
}

/**
 * Isolamento por contratante (requisito obrigatório seção 2/10.4): um usuário externo
 * só pode acessar dados do seu próprio município. Interno sempre passa.
 */
export function assertAcessoContratante(user: SessaoAtual, contratanteId: string) {
  if (user.tipo === TIPO_USUARIO.EXTERNO && user.municipioId !== contratanteId) {
    throw new AcessoNegadoError("Este contratante não pertence ao seu município");
  }
}
