"use server";

import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { assertVeProjeto } from "@/lib/visibilidade";
import { revalidatePath } from "next/cache";

/** Componente de calendário real (7.6): eventos com data, título, responsável, descrição. */
export async function criarEventoCronograma(formData: FormData) {
  const user = await exigirPermissao("projeto.gerenciar");
  const projetoId = String(formData.get("projetoId"));
  const projeto = await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId } });
  await assertVeProjeto(user, projeto.id);

  const data = String(formData.get("data") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const responsavelNome = String(formData.get("responsavelNome") ?? "").trim();

  if (!data || !titulo || !responsavelNome) {
    throw new Error("Data, título e responsável são obrigatórios.");
  }

  await prisma.eventoCronograma.create({
    data: { projetoId, data: new Date(data), titulo, descricao: descricao || null, responsavelNome },
  });
  revalidatePath(`/projetos/${projetoId}`);
}

export async function removerEventoCronograma(eventoId: string) {
  const user = await exigirPermissao("projeto.gerenciar");
  const evento = await prisma.eventoCronograma.findUniqueOrThrow({ where: { id: eventoId }, include: { projeto: true } });
  await assertVeProjeto(user, evento.projetoId);

  await prisma.eventoCronograma.delete({ where: { id: eventoId } });
  revalidatePath(`/projetos/${evento.projetoId}`);
}
