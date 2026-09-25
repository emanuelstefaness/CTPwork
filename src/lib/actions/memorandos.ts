"use server";

import { prisma } from "@/lib/prisma";
import { requireInterno } from "@/lib/tenant";
import { registrarAuditoria } from "@/lib/audit";
import { gerarCodigoMemorando } from "@/lib/codigos";
import { getSignatureProvider } from "@/lib/signature/provider";
import { STATUS_MEMORANDO } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function criarMemorando(formData: FormData) {
  const user = await requireInterno();

  const setorIds = formData.getAll("setorIds").map(String).filter(Boolean);
  const acUserId = String(formData.get("acUserId") ?? "") || null;
  const assunto = String(formData.get("assunto") ?? "").trim().slice(0, 120);
  const corpo = String(formData.get("corpo") ?? "").trim();
  const modeloId = String(formData.get("modeloId") ?? "") || null;
  const signatarioIds = formData.getAll("signatarioIds").map(String).filter(Boolean);
  const cienciaIds = formData.getAll("cienciaIds").map(String).filter(Boolean);

  if (setorIds.length === 0) throw new Error("Selecione ao menos um setor destinatário.");
  if (!assunto) throw new Error("Assunto é obrigatório.");
  if (!corpo && !modeloId) throw new Error("Corpo é obrigatório.");

  let camposModelo: string | null = null;
  if (modeloId) {
    const modelo = await prisma.modeloFormulario.findUnique({ where: { id: modeloId } });
    if (modelo) {
      const campos = JSON.parse(modelo.campos) as { chave: string; obrigatorio: boolean }[];
      const valores: Record<string, string> = {};
      for (const campo of campos) {
        const v = String(formData.get(`modelo_${campo.chave}`) ?? "").trim();
        if (campo.obrigatorio && !v) {
          throw new Error(`Campo obrigatório do modelo ausente: ${campo.chave}`);
        }
        valores[campo.chave] = v;
      }
      camposModelo = JSON.stringify(valores);
    }
  }

  const codigo = await gerarCodigoMemorando();

  const memorando = await prisma.memorando.create({
    data: {
      codigo,
      assunto,
      corpo,
      modeloId,
      camposModelo,
      acUserId,
      criadoPorId: user.id,
      status: STATUS_MEMORANDO.ABERTO,
      setores: { create: setorIds.map((setorId) => ({ setorId })) },
    },
  });

  if (signatarioIds.length > 0) {
    await prisma.fluxoAssinatura.create({
      data: {
        memorandoId: memorando.id,
        signatarios: {
          create: signatarioIds.map((userId) => ({ userId, tipo: "INTERNO" })),
        },
      },
    });
  }

  if (cienciaIds.length > 0) {
    await prisma.memorandoCiencia.createMany({
      data: cienciaIds.map((userId) => ({ memorandoId: memorando.id, userId })),
    });
    await prisma.notificacao.createMany({
      data: cienciaIds.map((userId) => ({
        userId,
        tipo: "MEMORANDO_CIENCIA",
        mensagem: `Você foi marcado(a) para ciência no memorando "${memorando.codigo} — ${assunto}".`,
        entidadeTipo: "Memorando",
        entidadeId: memorando.id,
      })),
    });
  }

  await registrarAuditoria({
    userId: user.id,
    acao: "CRIAR",
    entidadeTipo: "Memorando",
    entidadeId: memorando.id,
  });

  revalidatePath("/memorandos");
  redirect(`/memorandos/${memorando.id}`);
}

/** Máquina de estado 6.1: só o setor destinatário/A·C move Aberto -> Em execução. */
export async function iniciarExecucaoMemorando(memorandoId: string) {
  const user = await requireInterno();
  const memorando = await prisma.memorando.findUniqueOrThrow({
    where: { id: memorandoId },
    include: { setores: true },
  });

  const podeExecutar =
    memorando.acUserId === user.id || memorando.setores.some((s) => s.setorId === user.setorId);
  if (!podeExecutar) throw new Error("Apenas o setor destinatário ou A/C pode iniciar a execução.");
  if (memorando.status !== STATUS_MEMORANDO.ABERTO) throw new Error("Memorando não está Aberto.");

  await prisma.memorando.update({
    where: { id: memorandoId },
    data: { status: STATUS_MEMORANDO.EM_EXECUCAO },
  });
  await registrarAuditoria({
    userId: user.id,
    acao: "INICIAR_EXECUCAO",
    entidadeTipo: "Memorando",
    entidadeId: memorandoId,
  });
  revalidatePath(`/memorandos/${memorandoId}`);
}

export async function concluirMemorando(memorandoId: string) {
  const user = await requireInterno();
  const memorando = await prisma.memorando.findUniqueOrThrow({
    where: { id: memorandoId },
    include: { fluxoAssinatura: { include: { signatarios: true } } },
  });

  if (memorando.fluxoAssinatura && !memorando.fluxoAssinatura.concluido) {
    throw new Error("Memorando exige assinatura de todos os signatários antes de concluir.");
  }

  await prisma.memorando.update({
    where: { id: memorandoId },
    data: { status: STATUS_MEMORANDO.CONCLUIDO },
  });
  await registrarAuditoria({
    userId: user.id,
    acao: "CONCLUIR",
    entidadeTipo: "Memorando",
    entidadeId: memorandoId,
  });
  revalidatePath(`/memorandos/${memorandoId}`);
}

/** Só emissor ou gestor cancela, a qualquer momento antes de Concluído. */
export async function cancelarMemorando(memorandoId: string) {
  const user = await requireInterno();
  const memorando = await prisma.memorando.findUniqueOrThrow({ where: { id: memorandoId } });

  const podeCancel = memorando.criadoPorId === user.id || user.perfilInterno === "GESTOR";
  if (!podeCancel) throw new Error("Apenas o emissor ou um Gestor pode cancelar.");
  if (memorando.status === STATUS_MEMORANDO.CONCLUIDO) {
    throw new Error("Memorando já concluído não pode ser cancelado.");
  }

  await prisma.memorando.update({
    where: { id: memorandoId },
    data: { status: STATUS_MEMORANDO.CANCELADO },
  });
  await registrarAuditoria({
    userId: user.id,
    acao: "CANCELAR",
    entidadeTipo: "Memorando",
    entidadeId: memorandoId,
  });
  revalidatePath(`/memorandos/${memorandoId}`);
}

/** Requisito 8.1: assinatura multiperfil — registra data/hora + IP para valor probatório. */
export async function assinarMemorando(memorandoId: string) {
  const user = await requireInterno();
  const fluxo = await prisma.fluxoAssinatura.findUnique({
    where: { memorandoId },
    include: { signatarios: true },
  });
  if (!fluxo) throw new Error("Este memorando não tem fluxo de assinatura.");

  const signatario = fluxo.signatarios.find((s) => s.userId === user.id);
  if (!signatario) throw new Error("Você não é signatário deste memorando.");
  if (signatario.status === "ASSINADO") return;

  const provider = getSignatureProvider(signatario.provider);
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "indisponível";
  const resultado = await provider.assinar({ signatarioId: signatario.id, ip });

  await prisma.signatario.update({
    where: { id: signatario.id },
    data: { status: "ASSINADO", assinadoEm: resultado.assinadoEm, ipAssinatura: resultado.ipAssinatura },
  });

  const restantes = await prisma.signatario.count({
    where: { fluxoId: fluxo.id, status: "PENDENTE" },
  });
  if (restantes === 0) {
    await prisma.fluxoAssinatura.update({ where: { id: fluxo.id }, data: { concluido: true } });
  }

  await registrarAuditoria({
    userId: user.id,
    acao: "ASSINAR",
    entidadeTipo: "Memorando",
    entidadeId: memorandoId,
    detalhe: `ip=${resultado.ipAssinatura}`,
  });
  revalidatePath(`/memorandos/${memorandoId}`);
}
