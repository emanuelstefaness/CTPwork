"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";
import { exigirNoProjeto } from "@/lib/membros-projeto";
import { assertVeProjeto } from "@/lib/visibilidade";
import { revalidatePath } from "next/cache";

/** Componente de calendário real (7.6): eventos com data, título, responsável, descrição. */
export async function criarEventoCronograma(formData: FormData) {
  const user = await requireSession();
  const projetoId = String(formData.get("projetoId"));
  const projeto = await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId } });
  await assertVeProjeto(user, projeto.id);
  await exigirNoProjeto(user, projeto.id, "projeto.gerenciar");

  const data = new Date(String(formData.get("data") ?? ""));
  const titulo = String(formData.get("titulo") ?? "").trim().slice(0, 200);
  const descricao = String(formData.get("descricao") ?? "").trim().slice(0, 2000);
  const responsavelNome = String(formData.get("responsavelNome") ?? "").trim().slice(0, 120);

  if (Number.isNaN(data.getTime()) || !titulo || !responsavelNome) {
    throw new Error("Data, título e responsável são obrigatórios.");
  }

  await prisma.eventoCronograma.create({
    data: { projetoId, data, titulo, descricao: descricao || null, responsavelNome },
  });
  revalidatePath(`/projetos/${projetoId}`);
}

export async function removerEventoCronograma(eventoId: string) {
  const user = await requireSession();
  const evento = await prisma.eventoCronograma.findUniqueOrThrow({ where: { id: eventoId }, include: { projeto: true } });
  await assertVeProjeto(user, evento.projetoId);
  await exigirNoProjeto(user, evento.projetoId, "projeto.gerenciar");

  await prisma.eventoCronograma.delete({ where: { id: eventoId } });
  revalidatePath(`/projetos/${evento.projetoId}`);
}
