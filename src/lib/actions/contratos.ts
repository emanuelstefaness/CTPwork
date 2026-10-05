"use server";

import { prisma } from "@/lib/prisma";
import { exigir, exigirPermissao, requireSession, assertAcessoContratante, AcessoNegadoError } from "@/lib/tenant";
import { registrarAuditoria } from "@/lib/audit";
import { gerarCodigoContrato, gerarCodigoProjeto } from "@/lib/codigos";
import { getSignatureProvider } from "@/lib/signature/provider";
import { FLUXO_PADRAO_ID, garantirEtapasDosContratos, podeAvancarEtapa, progressoDoContrato } from "@/lib/fluxo-contrato";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { lerDocumentosPadrao } from "@/lib/documentos-padrao";
import { redirect } from "next/navigation";

export async function criarContrato(formData: FormData) {
  const user = await exigirPermissao("contrato.gerenciar");

  const objeto = String(formData.get("objeto") ?? "").trim();
  const contratanteId = String(formData.get("contratanteId") ?? "");
  const responsavelId = String(formData.get("responsavelId") ?? user.id);
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!objeto) throw new Error("Objeto do contrato é obrigatório.");
  if (!contratanteId) throw new Error("Contratante é obrigatório.");

  // Tipo de contrato: as etapas do fluxo escolhido são copiadas para o contrato.
  const fluxoId = String(formData.get("fluxoId") ?? "") || FLUXO_PADRAO_ID;
  const fluxo = await prisma.fluxoContrato.findUnique({ where: { id: fluxoId }, include: { etapas: { orderBy: { ordem: "asc" } } } });
  if (!fluxo || !fluxo.ativo) throw new Error("Escolha um tipo de contrato ativo.");
  if (fluxo.municipioId && fluxo.municipioId !== contratanteId) throw new Error(`O tipo "${fluxo.nome}" é exclusivo de outra prefeitura.`);
  if (fluxo.etapas.length < 2) throw new Error(`O tipo "${fluxo.nome}" precisa de pelo menos 2 etapas. Complete-o em Cadastros › Fluxos de contrato.`);

  const codigo = await gerarCodigoContrato();

  const contrato = await prisma.contrato.create({
    data: {
      codigo,
      objeto,
      contratanteId,
      responsavelId,
      fluxoId: fluxo.id,
      etapaAtual: fluxo.etapas[0].chave,
      tags: tags.length ? JSON.stringify(tags) : null,
      etapas: {
        create: fluxo.etapas.map((e) => ({
          ordem: e.ordem,
          chave: e.chave,
          nome: e.nome,
          curto: e.curto,
          exigeAssinaturas: e.exigeAssinaturas,
          liberaProjeto: e.liberaProjeto,
          perfisQueAvancam: e.perfisQueAvancam,
        })),
      },
    },
  });

  await registrarAuditoria({ userId: user.id, acao: "CRIAR", entidadeTipo: "Contrato", entidadeId: contrato.id, detalhe: fluxo.nome });
  revalidatePath("/contratos");
  redirect(`/contratos/${contrato.id}`);
}

/** Carrega o contrato com as etapas do seu fluxo (copiando-as, se ainda não tiver). */
async function contratoComEtapas(contratoId: string) {
  await garantirEtapasDosContratos([contratoId]);
  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId },
    include: { fluxoAssinatura: true, etapas: { orderBy: { ordem: "asc" } } },
  });
  if (!contrato) throw new Error("Contrato não encontrado.");
  return { contrato, ...progressoDoContrato(contrato.etapas, contrato.etapaAtual) };
}

/**
 * Regra 10.1: avança para a próxima etapa do fluxo do contrato. Uma etapa que exige assinaturas
 * só é deixada para trás com todas coletadas. Grava quem concluiu a etapa e quando.
 */
export async function avancarEtapaContrato(contratoId: string) {
  const user = await exigirPermissao("contrato.gerenciar");
  const { contrato, atual, proxima } = await contratoComEtapas(contratoId);
  if (!proxima) throw new Error("O contrato já está na última etapa do fluxo.");
  // A etapa pode estar restrita a alguns perfis (Cadastros › Fluxos de contrato).
  if (!podeAvancarEtapa(user, atual)) {
    throw new AcessoNegadoError(`Seu perfil (${user.perfilNome}) não pode concluir a etapa "${atual.nome}".`);
  }

  if (atual.exigeAssinaturas && !contrato.fluxoAssinatura?.concluido) {
    throw new Error(`A etapa "${atual.nome}" exige todas as assinaturas antes de avançar.`);
  }

  await prisma.$transaction([
    prisma.etapaContrato.update({ where: { id: atual.id }, data: { concluidaEm: new Date(), concluidaPorId: user.id } }),
    prisma.contrato.update({ where: { id: contratoId }, data: { etapaAtual: proxima.chave } }),
  ]);
  await registrarAuditoria({
    userId: user.id,
    acao: "AVANCAR_ETAPA",
    entidadeTipo: "Contrato",
    entidadeId: contratoId,
    detalhe: proxima.nome,
  });
  revalidatePath(`/contratos/${contratoId}`);
}

export async function criarFluxoAssinaturaContrato(contratoId: string, signatarios: { userId?: string; nomeExterno?: string; tipo: string }[]) {
  const user = await exigirPermissao("contrato.gerenciar");
  const { contrato, atual } = await contratoComEtapas(contratoId);
  if (!atual.exigeAssinaturas) throw new Error("A coleta de assinaturas é aberta na etapa do fluxo que exige assinaturas.");
  if (contrato.fluxoAssinatura) throw new Error("Este contrato já tem um fluxo de assinatura aberto.");
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
  // Pela prefeitura, só quem tem a permissão assina (ex.: o prefeito).
  if (user.tipo === "EXTERNO") exigir(user, "contrato.assinar");

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
  const user = await exigirPermissao("contrato.gerenciar");
  const contratoId = String(formData.get("contratoId"));
  const tipo = String(formData.get("tipo"));
  const dataVigencia = String(formData.get("dataVigencia"));
  const responsavelId = String(formData.get("responsavelId") ?? user.id);

  const { contrato: base, atual, temEtapaDeAssinatura } = await contratoComEtapas(contratoId);
  const contrato = { ...base, anexos: await prisma.anexo.findMany({ where: { contratoId } }) };

  if (!atual.liberaProjeto) {
    throw new Error(`O projeto só pode ser criado na etapa do fluxo que libera o projeto (o contrato está em "${atual.nome}").`);
  }
  if (temEtapaDeAssinatura && !contrato.fluxoAssinatura?.concluido) {
    throw new Error("O contrato precisa estar com todas as assinaturas coletadas para criar o projeto.");
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
  if (tipoModelo?.municipioId && tipoModelo.municipioId !== contrato.contratanteId) {
    throw new Error(`O tipo de projeto "${tipoModelo.nome}" é exclusivo de outra prefeitura.`);
  }
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

  // Documentos que o modelo pede por padrão em cada etapa (Cadastros › Fluxos de projeto).
  const pedidos = tipoModelo.etapas.flatMap((modelo, i) => {
    const etapa = projeto.etapas.find((e) => e.ordem === i);
    return etapa && modelo.temChecklist ? lerDocumentosPadrao(modelo.documentosPadrao).map((nome) => ({ etapaId: etapa.id, nome })) : [];
  });
  if (pedidos.length) await prisma.checklistItem.createMany({ data: pedidos });

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
