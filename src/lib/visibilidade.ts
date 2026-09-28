import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AcessoNegadoError, type SessaoAtual } from "@/lib/tenant";

/**
 * Quais projetos e contratos cada pessoa enxerga:
 *   - prefeitura: só os do próprio município (regra fixa);
 *   - CTP com perfil "vê só onde participa": onde é responsável, responsável por alguma etapa
 *     do projeto ou signatária do contrato;
 *   - demais perfis do CTP: todos.
 */

type Usuario = Pick<SessaoAtual, "id" | "tipo" | "municipioId" | "somenteParticipa">;

export function filtroProjetosVisiveis(user: Usuario): Prisma.ProjetoWhereInput {
  if (user.tipo === "EXTERNO") return { contratanteId: user.municipioId ?? "__nenhum__" };
  if (!user.somenteParticipa) return {};
  return {
    OR: [
      { responsavelId: user.id },
      { etapas: { some: { responsavelId: user.id } } },
      { contratoOrigem: { responsavelId: user.id } },
    ],
  };
}

export function filtroContratosVisiveis(user: Usuario): Prisma.ContratoWhereInput {
  if (user.tipo === "EXTERNO") return { contratanteId: user.municipioId ?? "__nenhum__" };
  if (!user.somenteParticipa) return {};
  return {
    OR: [
      { responsavelId: user.id },
      { fluxoAssinatura: { signatarios: { some: { userId: user.id } } } },
      { projetos: { some: { OR: [{ responsavelId: user.id }, { etapas: { some: { responsavelId: user.id } } }] } } },
    ],
  };
}

export async function podeVerProjeto(user: Usuario, projetoId: string) {
  return (await prisma.projeto.count({ where: { id: projetoId, ...filtroProjetosVisiveis(user) } })) > 0;
}

export async function podeVerContrato(user: Usuario, contratoId: string) {
  return (await prisma.contrato.count({ where: { id: contratoId, ...filtroContratosVisiveis(user) } })) > 0;
}

export async function assertVeProjeto(user: Usuario, projetoId: string) {
  if (!(await podeVerProjeto(user, projetoId))) throw new AcessoNegadoError("Este projeto não está entre os que você acompanha.");
}

export async function assertVeContrato(user: Usuario, contratoId: string) {
  if (!(await podeVerContrato(user, contratoId))) throw new AcessoNegadoError("Este contrato não está entre os que você acompanha.");
}
