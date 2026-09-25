import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/tenant";

/**
 * Conversas com o município fora das etapas. Regras compartilhadas entre páginas e actions:
 * o município só enxerga as conversas dele; o CTP enxerga todas.
 */

export function filtroVisibilidade(user: SessaoAtual) {
  return user.tipo === "EXTERNO" ? { municipioId: user.municipioId ?? "__nenhum__" } : {};
}

/**
 * "Não lida" = chegou mensagem do OUTRO lado depois da última vez que a pessoa abriu a conversa.
 * Resposta de um colega do CTP não acende a conversa para os demais colegas — só o município
 * acende para o CTP e vice-versa.
 */
export function estaNaoLida(
  conversa: { ultimaMensagemEm: Date; leituras: { lidoEm: Date }[]; mensagens: { autor: { tipo: string } }[] },
  user: { tipo: string },
) {
  const ultima = conversa.mensagens[0];
  if (!ultima || ultima.autor.tipo === user.tipo) return false;
  const lida = conversa.leituras[0]?.lidoEm;
  return !lida || lida < conversa.ultimaMensagemEm;
}

/** Inclusões mínimas para calcular `estaNaoLida` numa listagem. */
export function incluirEstadoLeitura(userId: string) {
  return {
    leituras: { where: { userId }, select: { lidoEm: true } },
    mensagens: { orderBy: { createdAt: "desc" as const }, take: 1, include: { autor: { select: { nome: true, tipo: true } } } },
  };
}

export async function contarConversasNaoLidas(user: SessaoAtual) {
  const conversas = await prisma.conversa.findMany({
    where: { ...filtroVisibilidade(user), status: "ABERTA" },
    select: {
      ultimaMensagemEm: true,
      leituras: { where: { userId: user.id }, select: { lidoEm: true } },
      mensagens: { orderBy: { createdAt: "desc" }, take: 1, select: { autor: { select: { tipo: true } } } },
    },
  });
  return conversas.filter((c) => estaNaoLida(c, user)).length;
}
