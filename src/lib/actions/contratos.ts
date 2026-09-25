"use server";

import { prisma } from "@/lib/prisma";
import { requireInterno, requireSession, assertAcessoContratante } from "@/lib/tenant";
import { registrarAuditoria } from "@/lib/audit";
import { gerarCodigoContrato, gerarCodigoProjeto } from "@/lib/codigos";
import { getSignatureProvider } from "@/lib/signature/provider";
import { ETAPAS_CONTRATO, ETAPA_CONTRATO_FINAL } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function criarContrato(formData: FormData) {
  const user = await requireInterno();

  const objeto = String(formData.get("objeto") ?? "").trim();
  const contratanteId = String(formData.get("contratanteId") ?? "");
  const responsavelId = String(formData.get("responsavelId") ?? user.id);
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!objeto) throw new Error("Objeto do contrato é obrigatório.");
  if (!contratanteId) throw new Error("Contratante é obrigatório.");

  const codigo = await gerarCodigoContrato();

  const contrato = await prisma.contrato.create({
    data: {
      codigo,
      objeto,
      contratanteId,
      responsavelId,
      etapaAtual: ETAPAS_CONTRATO[0].chave,
      tags: tags.length ? JSON.stringify(tags) : null,
    },
  });

  await registrarAuditoria({ userId: user.id, acao: "CRIAR", entidadeTipo: "Contrato", entidadeId: contrato.id });
  revalidatePath("/contratos");
  redirect(`/contratos/${contrato.id}`);
}

/** Regra 10.1: não avança sem os campos obrigatórios da etapa atual (aqui: exige exit-signature na etapa de assinatura). */
export async function avancarEtapaContrato(contratoId: string) {
  const user = await requireInterno();
  const contrato = await prisma.contrato.findUniqueOrThrow({
    where: { id: contratoId },
    include: { fluxoAssinatura: true },
  });

  const idxAtual = ETAPAS_CONTRATO.findIndex((e) => e.chave === contrato.etapaAtual);
  if (idxAtual === -1 || idxAtual === ETAPAS_CONTRATO.length - 1) {
    throw new Error("Contrato já está na última etapa.");
  }

  const proxima = ETAPAS_CONTRATO[idxAtual + 1];

  // Etapa de assinatura: só avança para "assinado" se o fluxo estiver 100% concluído.
  if (proxima.chave === "TERMO_REFERENCIA_ASSINADO" && !contrato.fluxoAssinatura?.concluido) {
    throw new Error("A minuta do termo de referência precisa estar 100% assinada para avançar.");
  }

  await prisma.contrato.update({ where: { id: contratoId }, data: { etapaAtual: proxima.chave } });
  await registrarAuditoria({
    userId: user.id,
    acao: "AVANCAR_ETAPA",
    entidadeTipo: "Contrato",
    entidadeId: contratoId,
    detalhe: proxima.chave,
  });
  revalidatePath(`/contratos/${contratoId}`);
}

export async function criarFluxoAssinaturaContrato(contratoId: string, signatarios: { userId?: string; nomeExterno?: string; tipo: string }[]) {
  const user = await requireInterno();
  await prisma.fluxoAssinatura.create({
    data: {
      contratoId,
      signatarios: { create: signatarios },
    },
  });
  await registrarAuditoria({ userId: user.id, acao: "CRIAR_FLUXO_ASSINATURA", entidadeTipo: "Contrato", entidadeId: contratoId });
  revalidatePath(`/contratos/${contratoId}`);
}

export async function iniciarAssinaturaContrato(formData: FormData) {
  const contratoId = String(formData.get("contratoId"));
  const internoIds = formData.getAll("internoIds").map(String);
  const nomeExterno = String(formData.get("nomeExterno") ?? "").trim();

  const signatarios: { userId?: string; nomeExterno?: string; tipo: string }[] = internoIds.map((id) => ({
    userId: id,
    tipo: "INTERNO",
  }));
  if (nomeExterno) signatarios.push({ nomeExterno, tipo: "EXTERNO" });

  if (signatarios.length === 0) throw new Error("Informe ao menos um signatário.");

  await criarFluxoAssinaturaContrato(contratoId, signatarios);
}

/** Assinatura por usuário externo do município (só o vinculado ao contratante). */
export async function assinarContrato(contratoId: string) {
  const user = await requireSession();
  const contrato = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
  assertAcessoContratante(user, contrato.contratanteId);

  const fluxo = await prisma.fluxoAssinatura.findUnique({
    where: { contratoId },
    include: { signatarios: true },
  });
  if (!fluxo) throw new Error("Este contrato não tem fluxo de assinatura aberto.");

  const signatario =
    user.tipo === "EXTERNO"
      ? fluxo.signatarios.find((s) => s.tipo === "EXTERNO" && s.status === "PENDENTE")
      : fluxo.signatarios.find((s) => s.userId === user.id);
  if (!signatario) throw new Error("Você não é signatário pendente deste contrato.");

  const provider = getSignatureProvider(signatario.provider);
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "indisponível";
  const resultado = await provider.assinar({ signatarioId: signatario.id, ip });

  await prisma.signatario.update({
    where: { id: signatario.id },
    data: { status: "ASSINADO", assinadoEm: resultado.assinadoEm, ipAssinatura: resultado.ipAssinatura },
  });

  const restantes = await prisma.signatario.count({ where: { fluxoId: fluxo.id, status: "PENDENTE" } });
  if (restantes === 0) {
    await prisma.fluxoAssinatura.update({ where: { id: fluxo.id }, data: { concluido: true } });
  }

  await registrarAuditoria({
    userId: user.id,
    acao: "ASSINAR",
    entidadeTipo: "Contrato",
    entidadeId: contratoId,
    detalhe: `ip=${resultado.ipAssinatura}`,
  });
  revalidatePath(`/contratos/${contratoId}`);
}

/**
 * Ação "Criar Projeto": habilitada só com etapa final assinada (6.2).
 * Herança 9.6: contratante + vínculo ao contrato + anexos (por referência, sem duplicar arquivo).
 */
export async function criarProjetoDoContrato(formData: FormData) {
  const user = await requireInterno();
  const contratoId = String(formData.get("contratoId"));
  const tipo = String(formData.get("tipo"));
  const dataVigencia = String(formData.get("dataVigencia"));
  const responsavelId = String(formData.get("responsavelId") ?? user.id);

  const contrato = await prisma.contrato.findUniqueOrThrow({
    where: { id: contratoId },
    include: { fluxoAssinatura: true, anexos: true },
  });

  if (contrato.etapaAtual !== ETAPA_CONTRATO_FINAL || !contrato.fluxoAssinatura?.concluido) {
    throw new Error('Só é possível criar o projeto quando "Contrato e termo de referência" estiver 100% assinado.');
  }
  if (!tipo || !dataVigencia) throw new Error("Tipo do projeto e data de vigência são obrigatórios.");

  const sequenciaNoContrato = (await prisma.projeto.count({ where: { contratoOrigemId: contratoId } })) + 1;
  const codigo = gerarCodigoProjeto(contrato.codigo, sequenciaNoContrato);

  // Fluxo de etapas vem do modelo configurável (/cadastros?aba=fluxos), não mais fixo no código —
  // isso é o que dá autonomia para criar tipos de projeto novos (ex.: "Plano de Mobilidade") sem
  // depender de alteração de código.
  const tipoModelo = await prisma.tipoProjetoModelo.findUnique({
    where: { chave: tipo },
    include: { etapas: { orderBy: { ordem: "asc" } } },
  });
  if (!tipoModelo || tipoModelo.etapas.length === 0) {
    throw new Error('Este tipo de projeto ainda não tem um fluxo de etapas configurado em "Cadastros › Fluxos de projeto".');
  }

  const projeto = await prisma.projeto.create({
    data: {
      codigo,
      tipo,
      contratanteId: contrato.contratanteId,
      contratoOrigemId: contrato.id,
      dataVigencia: new Date(dataVigencia),
      responsavelId,
      etapas: {
        create: tipoModelo.etapas.map((etapa, i) => ({
          nome: etapa.nome,
          ordem: i,
          tipoFluxo: tipo,
          modoRevisao: etapa.modoRevisao,
          responsavelId,
          status: i === 0 ? "EM_ANDAMENTO" : "NAO_INICIADA",
          temInformacoesProjeto: etapa.temInformacoesProjeto,
          temFormulario: etapa.temFormulario,
          temChecklist: etapa.temChecklist,
          temRevisao: etapa.temRevisao,
        })),
      },
    },
    include: { etapas: true },
  });

  // Herda anexos do contrato por referência (não duplica arquivo).
  if (contrato.anexos.length > 0) {
    const etapaChecklist = projeto.etapas.find((e) => e.temChecklist) ?? projeto.etapas[0];
    await prisma.checklistItem.createMany({
      data: contrato.anexos.map((a) => ({
        etapaId: etapaChecklist.id,
        nome: `Herdado do contrato: ${a.nomeOriginal}`,
        status: "APROVADO",
        arquivoId: null,
      })),
    });
  }

  await registrarAuditoria({ userId: user.id, acao: "CRIAR_PROJETO", entidadeTipo: "Contrato", entidadeId: contratoId, detalhe: projeto.id });
  revalidatePath("/projetos");
  redirect(`/projetos/${projeto.id}`);
}
