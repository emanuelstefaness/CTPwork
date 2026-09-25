import { prisma } from "@/lib/prisma";

/** Regra 10.5: toda aprovação/reprovação de artigo ou documento registra autor + timestamp, sem exceção. */
export async function registrarAuditoria(params: {
  userId: string;
  acao: string;
  entidadeTipo: string;
  entidadeId: string;
  detalhe?: string;
}) {
  await prisma.auditLog.create({ data: params });
}
