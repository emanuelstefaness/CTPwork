import { prisma } from "@/lib/prisma";
import { lerDocumentosPadraoContrato } from "@/lib/documentos-contrato-tipos";

export { documentosEmAberto, documentosPadraoDoFormulario, lerDocumentosPadraoContrato } from "@/lib/documentos-contrato-tipos";
export type { DocumentoPadraoContrato, EnviaQuem } from "@/lib/documentos-contrato-tipos";

/**
 * Cria no contrato os documentos padrão de cada etapa informada que ainda não foram pedidos
 * (comparando pelo nome). Usado ao criar o contrato e ao aplicar um tipo editado aos contratos
 * que ainda não passaram da etapa.
 */
export async function pedirDocumentosPadrao(contratoId: string, etapas: { chave: string; documentosPadrao: string }[]) {
  const existentes = await prisma.documentoContrato.findMany({ where: { contratoId }, select: { etapaChave: true, nome: true } });
  const jaPedido = new Set(existentes.map((d) => `${d.etapaChave}|${d.nome.toLowerCase()}`));
  const novos = etapas.flatMap((e) =>
    lerDocumentosPadraoContrato(e.documentosPadrao)
      .filter((d) => !jaPedido.has(`${e.chave}|${d.nome.toLowerCase()}`))
      .map((d) => ({ contratoId, etapaChave: e.chave, nome: d.nome, enviaQuem: d.enviaQuem })),
  );
  if (novos.length) await prisma.documentoContrato.createMany({ data: novos });
  return novos.length;
}
