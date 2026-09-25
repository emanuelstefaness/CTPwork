"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";
import { revalidatePath } from "next/cache";

export async function marcarNotificacaoLida(notificacaoId: string) {
  const user = await requireSession();
  const notificacao = await prisma.notificacao.findUniqueOrThrow({ where: { id: notificacaoId } });
  if (notificacao.userId !== user.id) throw new Error("Notificação não pertence a este usuário.");

  await prisma.notificacao.update({ where: { id: notificacaoId }, data: { lida: true } });
  revalidatePath("/notificacoes");
}

export async function marcarTodasNotificacoesLidas() {
  const user = await requireSession();
  await prisma.notificacao.updateMany({ where: { userId: user.id, lida: false }, data: { lida: true } });
  revalidatePath("/notificacoes");
}
