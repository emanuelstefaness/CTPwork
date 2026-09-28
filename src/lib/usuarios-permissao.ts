import { prisma } from "@/lib/prisma";
import { lerPermissoes, perfilPadrao, type Permissao } from "@/lib/permissoes";

type UsuarioComPerfil = { id: string; tipo: string; perfilInterno: string | null; perfilId: string | null };

async function permissoesPorUsuario(usuarios: UsuarioComPerfil[], ajuste?: { perfilId: string; permissoes: string[] }) {
  const perfis = await prisma.perfil.findMany({ select: { id: true, tipo: true, permissoes: true } });
  const porId = new Map(perfis.map((p) => [p.id, p]));
  return usuarios.map((u) => {
    let perfilId = u.perfilId ?? perfilPadrao(u);
    if (porId.get(perfilId)?.tipo !== u.tipo) perfilId = perfilPadrao(u);
    const json = ajuste && ajuste.perfilId === perfilId ? JSON.stringify(ajuste.permissoes) : porId.get(perfilId)?.permissoes;
    return { id: u.id, permissoes: lerPermissoes(json, u.tipo) };
  });
}

/** Usuários ativos cujo perfil tem a permissão (ex.: quem recebe o aviso de prazo vencido). */
export async function usuariosComPermissao(permissao: Permissao): Promise<string[]> {
  const usuarios = await prisma.user.findMany({ where: { ativo: true }, select: { id: true, tipo: true, perfilInterno: true, perfilId: true } });
  return (await permissoesPorUsuario(usuarios)).filter((u) => u.permissoes.includes(permissao)).map((u) => u.id);
}

/**
 * Trava contra se trancar fora: depois da mudança, alguém ativo ainda acessa Cadastros?
 * Simula a mudança (usuário desativado, perfil trocado ou permissões do perfil editadas).
 */
export async function aindaHaAdministrador(mudanca: {
  desativarUsuarioId?: string;
  trocarPerfil?: { usuarioId: string; perfilId: string };
  editarPerfil?: { perfilId: string; permissoes: string[] };
}): Promise<boolean> {
  const usuarios = (await prisma.user.findMany({ where: { ativo: true }, select: { id: true, tipo: true, perfilInterno: true, perfilId: true } }))
    .filter((u) => u.id !== mudanca.desativarUsuarioId)
    .map((u) => (mudanca.trocarPerfil?.usuarioId === u.id ? { ...u, perfilId: mudanca.trocarPerfil.perfilId } : u));
  const lista = await permissoesPorUsuario(usuarios, mudanca.editarPerfil);
  return lista.some((u) => u.permissoes.includes("cadastros"));
}

export const MSG_SEM_ADMINISTRADOR = "Essa mudança deixaria o sistema sem ninguém com acesso a Cadastros. Dê essa permissão a outra pessoa antes.";
