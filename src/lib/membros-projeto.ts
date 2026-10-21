import { prisma } from "@/lib/prisma";
import { AcessoNegadoError, type SessaoAtual } from "@/lib/tenant";
import { PERMISSOES, pode, type Permissao } from "@/lib/permissoes";

/**
 * Pessoas adicionadas a um projeto (ProjetoMembro). A participação só SOMA ao perfil:
 *   VER    — o projeto passa a aparecer para a pessoa (ver src/lib/visibilidade.ts);
 *   EDITAR — além disso, dentro deste projeto ela tem as permissões de conduzir etapas e
 *            escrever minutas, mesmo que o perfil não as tenha em geral.
 * Quem adiciona e remove: perfis que gerenciam contratos (são eles que criam os projetos).
 */

export const NIVEIS_MEMBRO = {
  VER: { rotulo: "Ver", descricao: "Acompanha o projeto: etapas, documentos, minutas e chat." },
  EDITAR: { rotulo: "Editar", descricao: "Também conduz as etapas e escreve as minutas deste projeto." },
} as const;
export type NivelMembro = keyof typeof NIVEIS_MEMBRO;

export const nivelValido = (v: unknown): v is NivelMembro => v === "VER" || v === "EDITAR";

/** O que "Editar" acrescenta, dentro do projeto, ao que o perfil já permite. */
const DO_EDITOR: Permissao[] = ["projeto.gerenciar", "minuta.escrever"];

/** Permissões da pessoa dentro deste projeto: as do perfil + as que a participação dá. */
export async function permissoesNoProjeto(user: SessaoAtual, projetoId: string): Promise<Permissao[]> {
  if (user.tipo !== "INTERNO") return user.permissoes;
  const membro = await prisma.projetoMembro.findUnique({ where: { projetoId_userId: { projetoId, userId: user.id } }, select: { nivel: true } });
  return membro?.nivel === "EDITAR" ? [...new Set([...user.permissoes, ...DO_EDITOR])] : user.permissoes;
}

/** Exige a permissão dentro do projeto (perfil ou participação "Editar"). */
export async function exigirNoProjeto(user: SessaoAtual, projetoId: string, permissao: Permissao) {
  if (!(await permissoesNoProjeto(user, projetoId)).includes(permissao)) {
    throw new AcessoNegadoError(`Você não tem permissão para ${PERMISSOES[permissao].rotulo.toLowerCase()} neste projeto. Peça para ser adicionado como "Editar".`);
  }
}

/** Quem pode adicionar, mudar e remover pessoas dos projetos. */
export const gerenciaMembros = (user: SessaoAtual) => user.tipo === "INTERNO" && pode(user, "contrato.gerenciar");
