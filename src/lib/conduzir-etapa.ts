import { prisma } from "@/lib/prisma";
import { AcessoNegadoError, type SessaoAtual } from "@/lib/tenant";
import { lerIds } from "@/lib/permissoes";
import { permissoesNoProjeto } from "@/lib/membros-projeto";

/**
 * Quem conduz uma etapa de projeto pelo CTP: iniciar, pedir ação da prefeitura, prazo, pedir e
 * aprovar documentos e concluir. Precisa de "Gerenciar etapas de projeto" (pelo perfil ou por
 * participar do projeto como "Editar") e, se o tipo de projeto restringe a etapa a alguns perfis
 * (Cadastros › Tipos de projeto), ter um deles.
 */
export function conduzEtapa(
  user: { perfilId: string },
  permissoesNoProjeto: readonly string[],
  etapa: { perfisQueConduzem: string },
) {
  if (!permissoesNoProjeto.includes("projeto.gerenciar")) return false;
  const perfis = lerIds(etapa.perfisQueConduzem);
  return perfis.length === 0 || perfis.includes(user.perfilId);
}

/** Nomes dos perfis, na ordem em que foram gravados (para mensagens como "conduzida por: Gestor"). */
export async function nomesDosPerfis(ids: string[]) {
  if (!ids.length) return [];
  const perfis = await prisma.perfil.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } });
  return ids.map((id) => perfis.find((p) => p.id === id)?.nome).filter((n): n is string => !!n);
}

export async function exigirConduzirEtapa(user: SessaoAtual, etapa: { projetoId: string; perfisQueConduzem: string }) {
  const permissoes = await permissoesNoProjeto(user, etapa.projetoId);
  if (conduzEtapa(user, permissoes, etapa)) return;
  if (!permissoes.includes("projeto.gerenciar")) {
    throw new AcessoNegadoError('Você não tem permissão para conduzir etapas neste projeto. Peça para ser adicionado como "Editar".');
  }
  const nomes = await nomesDosPerfis(lerIds(etapa.perfisQueConduzem));
  throw new AcessoNegadoError(`Esta etapa só pode ser conduzida por: ${nomes.join(", ") || "perfis definidos em Cadastros"}.`);
}
