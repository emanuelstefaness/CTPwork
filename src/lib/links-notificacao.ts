import { prisma } from "@/lib/prisma";

type NotificacaoLink = { id: string; entidadeTipo: string | null; entidadeId: string | null };

/** Caminho no sistema para onde cada notificação leva (usado na tela de notificações e nos e-mails). */
export async function resolverLinks(notificacoes: NotificacaoLink[]): Promise<Map<string, string>> {
  const etapaIds = [...new Set(notificacoes.filter((n) => n.entidadeTipo === "EtapaProjeto" && n.entidadeId).map((n) => n.entidadeId!))];
  const etapas = etapaIds.length ? await prisma.etapaProjeto.findMany({ where: { id: { in: etapaIds } }, select: { id: true, projetoId: true } }) : [];
  const projetoDaEtapa = new Map(etapas.map((e) => [e.id, e.projetoId]));

  const links = new Map<string, string>();
  for (const n of notificacoes) {
    const id = n.entidadeId;
    let href = "/notificacoes";
    if (id) {
      if (n.entidadeTipo === "EtapaProjeto" && projetoDaEtapa.has(id)) href = `/projetos/${projetoDaEtapa.get(id)}?etapa=${id}`;
      else if (n.entidadeTipo === "Projeto") href = `/projetos/${id}`;
      else if (n.entidadeTipo === "Memorando") href = `/memorandos/${id}`;
      else if (n.entidadeTipo === "Contrato") href = `/contratos/${id}`;
      else if (n.entidadeTipo === "Conversa") href = `/conversas/${id}`;
    }
    links.set(n.id, href);
  }
  return links;
}
