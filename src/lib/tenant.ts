import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TIPO_USUARIO } from "@/lib/constants";

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
};

/** Sessão do cookie, só se o usuário ainda existir no banco — nunca lança, usada em páginas/layouts que preferem redirect a erro. */
export async function sessaoValidaOuNula(): Promise<SessaoAtual | null> {
  const session = await auth();
  if (!session?.user) return null;

  const existe = await prisma.user.findUnique({ where: { id: session.user.id }, select: { ativo: true } });
  // Usuário desativado cai aqui também: o layout manda para /api/sair-sessao-invalida, que apaga o cookie.
  if (!existe?.ativo) return null;

  return session.user as SessaoAtual;
}

/** Exige sessão autenticada e válida (usuário do cookie ainda existe no banco). */
export async function requireSession(): Promise<SessaoAtual> {
  const session = await auth();
  if (!session?.user) throw new AcessoNegadoError("Não autenticado");

  const existe = await prisma.user.findUnique({ where: { id: session.user.id }, select: { ativo: true } });
  if (!existe) throw new SessaoInvalidaError();
  if (!existe.ativo) throw new SessaoInvalidaError("Seu acesso foi desativado. Fale com a equipe do CTP.");

  return session.user as SessaoAtual;
}

/** Exige usuário interno (CTP). Memorandos e telas administrativas nunca são vistos por externos. */
export async function requireInterno(): Promise<SessaoAtual> {
  const user = await requireSession();
  if (user.tipo !== TIPO_USUARIO.INTERNO) throw new AcessoNegadoError("Restrito a usuários CTP");
  return user;
}

/** Exige perfil Gestor (aprovações, dashboard, reabertura de etapas/memorandos). */
export async function requireGestor(): Promise<SessaoAtual> {
  const user = await requireInterno();
  if (user.perfilInterno !== "GESTOR") throw new AcessoNegadoError("Restrito a Gestores");
  return user;
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
