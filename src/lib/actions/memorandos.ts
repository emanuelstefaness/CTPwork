"use server";

import { prisma } from "@/lib/prisma";
import { requireInterno } from "@/lib/tenant";
import { pode } from "@/lib/permissoes";
import { registrarAuditoria } from "@/lib/audit";
import { comCodigoUnico, gerarCodigoMemorando } from "@/lib/codigos";
import { getSignatureProvider } from "@/lib/signature/provider";
import { STATUS_MEMORANDO } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ipDaRequisicao } from "@/lib/ip";
import { redirect } from "next/navigation";

export async function criarMemorando(formData: FormData) {
  const user = await requireInterno();

  const unicos = (campo: string) => [...new Set(formData.getAll(campo).map(String).filter(Boolean))].slice(0, 50);
  const setorIds = unicos("setorIds");
  const acUserId = String(formData.get("acUserId") ?? "") || null;
  const assunto = String(formData.get("assunto") ?? "").trim().slice(0, 120);
  const corpo = String(formData.get("corpo") ?? "").trim().slice(0, 20000);
  const modeloId = String(formData.get("modeloId") ?? "") || null;
  const signatarioIds = unicos("signatarioIds");
  const cienciaIds = unicos("cienciaIds");

  if (setorIds.length === 0) throw new Error("Selecione ao menos um setor destinatário.");
  if (!assunto) throw new Error("Assunto é obrigatório.");
  if (!corpo && !modeloId) throw new Error("Corpo é obrigatório.");

  // Memorando é interno: setores existentes e só pessoas ativas do CTP (nunca um usuário da
  // prefeitura, que receberia o aviso com o assunto).
  if ((await prisma.setor.count({ where: { id: { in: setorIds } } })) !== setorIds.length) throw new Error("Setor destinatário não encontrado.");
  const pessoas = [...new Set([...signatarioIds, ...cienciaIds, ...(acUserId ? [acUserId] : [])])];
  if ((await prisma.user.count({ where: { id: { in: pessoas }, tipo: "INTERNO", ativo: true } })) !== pessoas.length) {
    throw new Error("Escolha as pessoas do memorando entre a equipe ativa do CTP.");
  }

  let camposModelo: string | null = null;
  if (modeloId) {
    const modelo = await prisma.modeloFormulario.findUnique({ where: { id: modeloId } });
    if (modelo) {
      const campos = JSON.parse(modelo.campos) as { chave: string; obrigatorio: boolean }[];
      const valores: Record<string, string> = {};
      for (const campo of campos) {
        const v = String(formData.get(`modelo_${campo.chave}`) ?? "").trim().slice(0, 5000);
        if (campo.obrigatorio && !v) {
          throw new Error(`Campo obrigatório do modelo ausente: ${campo.chave}`);
        }
        valores[campo.chave] = v;
      }
      camposModelo = JSON.stringify(valores);
    }
  }

  const memorando = await comCodigoUnico(gerarCodigoMemorando, (codigo) => prisma.memorando.create({
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
  }));

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

/** Conclui quem executa (setor destinatário ou A/C) ou quem emitiu; só memorando em andamento. */
export async function concluirMemorando(memorandoId: string) {
  const user = await requireInterno();
  const memorando = await prisma.memorando.findUniqueOrThrow({
    where: { id: memorandoId },
    include: { setores: true, fluxoAssinatura: { include: { signatarios: true } } },
  });

  const podeConcluir =
    memorando.criadoPorId === user.id || memorando.acUserId === user.id || memorando.setores.some((s) => s.setorId === user.setorId);
  if (!podeConcluir) throw new Error("Só quem emitiu o memorando, o setor destinatário ou a pessoa em A/C pode concluí-lo.");
  if (memorando.status !== STATUS_MEMORANDO.ABERTO && memorando.status !== STATUS_MEMORANDO.EM_EXECUCAO) {
    throw new Error("Este memorando já foi concluído ou cancelado.");
  }
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

  const podeCancel = memorando.criadoPorId === user.id || pode(user, "memorando.gerenciar");
  if (!podeCancel) throw new Error("Só quem criou o memorando, ou um perfil com permissão para cancelar memorandos de outras pessoas, pode cancelá-lo.");
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
    include: { signatarios: true, memorando: { select: { status: true } } },
  });
  if (!fluxo) throw new Error("Este memorando não tem fluxo de assinatura.");
  if (fluxo.memorando?.status === STATUS_MEMORANDO.CANCELADO) throw new Error("Memorando cancelado não recebe assinaturas.");

  const signatario = fluxo.signatarios.find((s) => s.userId === user.id);
  if (!signatario) throw new Error("Você não é signatário deste memorando.");
  if (signatario.status === "ASSINADO") return;

  const provider = getSignatureProvider(signatario.provider);
  const resultado = await provider.assinar({ signatarioId: signatario.id, ip: ipDaRequisicao(await headers()) });

  const assinou = await prisma.signatario.updateMany({
    where: { id: signatario.id, status: "PENDENTE" },
    data: { status: "ASSINADO", assinadoEm: resultado.assinadoEm, ipAssinatura: resultado.ipAssinatura },
  });
  if (assinou.count !== 1) return;

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
