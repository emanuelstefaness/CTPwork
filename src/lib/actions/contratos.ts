"use server";

import { prisma } from "@/lib/prisma";
import { exigir, exigirPermissao, requireSession, assertAcessoContratante, AcessoNegadoError } from "@/lib/tenant";
import { registrarAuditoria } from "@/lib/audit";
import { comCodigoUnico, gerarCodigoContrato, gerarCodigoProjeto } from "@/lib/codigos";
import { getSignatureProvider } from "@/lib/signature/provider";
import { FLUXO_PADRAO_ID, garantirEtapasDosContratos, podeAvancarEtapa, progressoDoContrato } from "@/lib/fluxo-contrato";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { lerDocumentosPadrao } from "@/lib/documentos-padrao";
import { documentosEmAberto, pedirDocumentosPadrao } from "@/lib/documentos-contrato";
import { assertVeContrato } from "@/lib/visibilidade";
import { salvarAnexo } from "@/lib/storage";
import { ipDaRequisicao } from "@/lib/ip";
import { redirect } from "next/navigation";

/** Pessoa do CTP, ativa, escolhida num formulário (responsável, signatário): nunca um id qualquer. */
async function internoAtivo(id: string, papel: string) {
  const u = await prisma.user.findFirst({ where: { id, tipo: "INTERNO", ativo: true }, select: { id: true } });
  if (!u) throw new Error(`Escolha ${papel} entre as pessoas ativas do CTP.`);
  return u.id;
}

export async function criarContrato(formData: FormData) {
  const user = await exigirPermissao("contrato.gerenciar");

  const objeto = String(formData.get("objeto") ?? "").trim().slice(0, 500);
  const contratanteId = String(formData.get("contratanteId") ?? "");
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 10);

  if (!objeto) throw new Error("Objeto do contrato é obrigatório.");
  if (!contratanteId || !(await prisma.municipio.findUnique({ where: { id: contratanteId }, select: { id: true } }))) {
    throw new Error("Escolha o município contratante.");
  }
  const responsavelId = await internoAtivo(String(formData.get("responsavelId") || user.id), "o responsável");

  // Tipo de contrato: as etapas do fluxo escolhido são copiadas para o contrato.
  const fluxoId = String(formData.get("fluxoId") ?? "") || FLUXO_PADRAO_ID;
  const fluxo = await prisma.fluxoContrato.findUnique({ where: { id: fluxoId }, include: { etapas: { orderBy: { ordem: "asc" } } } });
  if (!fluxo || !fluxo.ativo) throw new Error("Escolha um tipo de contrato ativo.");
  if (fluxo.municipioId && fluxo.municipioId !== contratanteId) throw new Error(`O tipo "${fluxo.nome}" é exclusivo de outra prefeitura.`);
  if (fluxo.etapas.length < 2) throw new Error(`O tipo "${fluxo.nome}" precisa de pelo menos 2 etapas. Complete-o em Cadastros › Fluxos de contrato.`);

  const contrato = await comCodigoUnico(gerarCodigoContrato, (codigo) => prisma.contrato.create({
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
          concluidaPelaPrefeitura: e.concluidaPelaPrefeitura,
        })),
      },
    },
  }));

  // Documentos que o tipo de contrato pede em cada etapa (Cadastros › Fluxos de contrato).
  await pedirDocumentosPadrao(contrato.id, fluxo.etapas);

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
  await assertVeContrato(user, contratoId);
  const { contrato, atual, proxima } = await contratoComEtapas(contratoId);
  if (!proxima) throw new Error("O contrato já está na última etapa do fluxo.");
  if (atual.concluidaPelaPrefeitura) throw new AcessoNegadoError(`A etapa "${atual.nome}" é concluída pela prefeitura.`);
  // A etapa pode estar restrita a alguns perfis (Cadastros › Fluxos de contrato).
  if (!podeAvancarEtapa(user, atual)) {
    throw new AcessoNegadoError(`Seu perfil (${user.perfilNome}) não pode concluir a etapa "${atual.nome}".`);
  }

  if (atual.exigeAssinaturas && !contrato.fluxoAssinatura?.concluido) {
    throw new Error(`A etapa "${atual.nome}" exige todas as assinaturas antes de avançar.`);
  }
  await concluirEtapaAtual(contratoId, atual, proxima, user.id, "AVANCAR_ETAPA");
}

/** Conclui a etapa atual (com quem e quando) e passa para a próxima — se não faltar documento. */
async function concluirEtapaAtual(contratoId: string, atual: { id: string; chave: string }, proxima: { chave: string; nome: string }, userId: string, acao: string) {
  const emAberto = documentosEmAberto(await prisma.documentoContrato.findMany({ where: { contratoId, etapaChave: atual.chave } }));
  if (emAberto.length) {
    throw new Error(`${emAberto.length === 1 ? "Falta 1 documento" : `Faltam ${emAberto.length} documentos`} desta etapa: ${emAberto.map((d) => d.nome).join(", ")}.`);
  }
  await prisma.$transaction([
    prisma.etapaContrato.update({ where: { id: atual.id }, data: { concluidaEm: new Date(), concluidaPorId: userId, motivoDevolucao: null } }),
    prisma.contrato.update({ where: { id: contratoId }, data: { etapaAtual: proxima.chave } }),
  ]);
  await registrarAuditoria({ userId, acao, entidadeTipo: "Contrato", entidadeId: contratoId, detalhe: proxima.nome });
  revalidatePath(`/contratos/${contratoId}`);
}

/** Etapa concluída pela prefeitura (ex.: aprovação do orçamento): quem tem "contrato.aprovar" aprova. */
async function etapaParaAprovar(contratoId: string) {
  const user = await requireSession();
  if (user.tipo !== "EXTERNO") throw new AcessoNegadoError("Esta etapa é concluída pela prefeitura.");
  exigir(user, "contrato.aprovar");
  await assertVeContrato(user, contratoId);
  const dados = await contratoComEtapas(contratoId);
  if (!dados.atual.concluidaPelaPrefeitura) throw new Error("A etapa atual não depende de aprovação da prefeitura.");
  return { user, ...dados };
}

export async function aprovarEtapaContrato(contratoId: string) {
  const { user, contrato, atual, proxima } = await etapaParaAprovar(contratoId);
  if (!proxima) throw new Error("O contrato já está na última etapa do fluxo.");
  await concluirEtapaAtual(contratoId, atual, proxima, user.id, "APROVAR_ETAPA");
  await prisma.notificacao.create({
    data: {
      userId: contrato.responsavelId, tipo: "MUNICIPIO_RESPONDEU",
      mensagem: `A prefeitura aprovou "${atual.nome}" no contrato ${contrato.codigo}. O contrato seguiu para "${proxima.nome}".`,
      entidadeTipo: "Contrato", entidadeId: contratoId,
    },
  });
}

/**
 * A prefeitura não aprova: o contrato volta à etapa anterior com o motivo, e os documentos que o
 * CTP entregou nela (ex.: a proposta de orçamento) voltam a ser pedidos.
 */
export async function pedirRevisaoEtapaContrato(formData: FormData) {
  const contratoId = String(formData.get("contratoId"));
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 1000);
  if (!motivo) throw new Error("Explique o que precisa ser revisto — o CTP vai ver.");
  const { user, contrato, atual, indice } = await etapaParaAprovar(contratoId);
  const anterior = contrato.etapas[indice - 1];
  if (!anterior) throw new Error("Não há etapa anterior para onde devolver o contrato.");

  await prisma.$transaction([
    prisma.etapaContrato.update({ where: { id: anterior.id }, data: { concluidaEm: null, concluidaPorId: null, motivoDevolucao: motivo } }),
    prisma.contrato.update({ where: { id: contratoId }, data: { etapaAtual: anterior.chave } }),
    prisma.documentoContrato.updateMany({
      where: { contratoId, etapaChave: anterior.chave, enviaQuem: "CTP" },
      data: { status: "PENDENTE", anexoId: null, motivoRecusa: motivo },
    }),
  ]);
  await prisma.notificacao.create({
    data: {
      userId: contrato.responsavelId, tipo: "MUNICIPIO_RESPONDEU",
      mensagem: `A prefeitura pediu revisão em "${atual.nome}" (contrato ${contrato.codigo}): ${motivo}`,
      entidadeTipo: "Contrato", entidadeId: contratoId,
    },
  });
  await registrarAuditoria({ userId: user.id, acao: "PEDIR_REVISAO_ETAPA", entidadeTipo: "Contrato", entidadeId: contratoId, detalhe: motivo });
  revalidatePath(`/contratos/${contratoId}`);
}

/**
 * Abre a coleta de assinaturas: pessoas do CTP (escolhidas entre as ativas) e, pelo município,
 * quem tiver a permissão de assinar. Os signatários nascem sempre pendentes; nada do que vem do
 * navegador além dos ids e do nome é gravado.
 */
export async function iniciarAssinaturaContrato(formData: FormData) {
  const user = await exigirPermissao("contrato.gerenciar");
  const contratoId = String(formData.get("contratoId"));
  await assertVeContrato(user, contratoId);
  const internoIds = [...new Set(formData.getAll("internoIds").map(String).filter(Boolean))].slice(0, 20);
  const nomeExterno = String(formData.get("nomeExterno") ?? "").trim().slice(0, 120);
  if (internoIds.length === 0 && !nomeExterno) throw new Error("Informe ao menos um signatário.");

  const internos = await prisma.user.findMany({ where: { id: { in: internoIds }, tipo: "INTERNO", ativo: true }, select: { id: true } });
  if (internos.length !== internoIds.length) throw new Error("Escolha os signatários do CTP entre as pessoas ativas.");

  const { contrato, atual } = await contratoComEtapas(contratoId);
  if (!atual.exigeAssinaturas) throw new Error("A coleta de assinaturas é aberta na etapa do fluxo que exige assinaturas.");
  if (contrato.fluxoAssinatura) throw new Error("Este contrato já tem um fluxo de assinatura aberto.");
  await prisma.fluxoAssinatura.create({
    data: {
      contratoId,
      signatarios: {
        create: [
          ...internos.map((u) => ({ userId: u.id, tipo: "INTERNO" })),
          ...(nomeExterno ? [{ nomeExterno, tipo: "EXTERNO" }] : []),
        ],
      },
    },
  });
  await registrarAuditoria({ userId: user.id, acao: "CRIAR_FLUXO_ASSINATURA", entidadeTipo: "Contrato", entidadeId: contratoId });
  revalidatePath(`/contratos/${contratoId}`);
}

/** Assinatura de quem foi indicado no fluxo; pelo município, quem tem a permissão de assinar. */
export async function assinarContrato(contratoId: string) {
  const user = await requireSession();
  const contrato = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
  assertAcessoContratante(user, contrato.contratanteId);
  await assertVeContrato(user, contratoId);
  // Pela prefeitura, só quem tem a permissão assina (ex.: o prefeito).
  if (user.tipo === "EXTERNO") exigir(user, "contrato.assinar");

  const fluxo = await prisma.fluxoAssinatura.findUnique({
    where: { contratoId },
    include: { signatarios: true },
  });
  if (!fluxo) throw new Error("Este contrato não tem fluxo de assinatura aberto.");
  if (fluxo.concluido) throw new Error("Todas as assinaturas deste contrato já foram coletadas.");

  const signatario =
    user.tipo === "EXTERNO"
      ? fluxo.signatarios.find((s) => s.tipo === "EXTERNO" && s.status === "PENDENTE")
      : fluxo.signatarios.find((s) => s.userId === user.id && s.status === "PENDENTE");
  if (!signatario) throw new Error("Você não é signatário pendente deste contrato.");

  const provider = getSignatureProvider(signatario.provider);
  const resultado = await provider.assinar({ signatarioId: signatario.id, ip: ipDaRequisicao(await headers()) });

  // Só assina se ainda estiver pendente (dois cliques ao mesmo tempo não assinam duas vezes). Pela
  // prefeitura, grava também QUEM assinou em nome do município.
  const assinou = await prisma.signatario.updateMany({
    where: { id: signatario.id, status: "PENDENTE" },
    data: {
      status: "ASSINADO", assinadoEm: resultado.assinadoEm, ipAssinatura: resultado.ipAssinatura,
      ...(user.tipo === "EXTERNO" ? { userId: user.id } : {}),
    },
  });
  if (assinou.count !== 1) throw new Error("Esta assinatura já foi registrada.");

  const restantes = await prisma.signatario.count({ where: { fluxoId: fluxo.id, status: "PENDENTE" } });
  if (restantes === 0) {
    await prisma.fluxoAssinatura.update({ where: { id: fluxo.id }, data: { concluido: true } });
  }

  await registrarAuditoria({
    userId: user.id,
    acao: "ASSINAR",
    entidadeTipo: "Contrato",
    entidadeId: contratoId,
    detalhe: `${signatario.nomeExterno ? `em nome de ${signatario.nomeExterno} · ` : ""}ip=${resultado.ipAssinatura}`,
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
  await assertVeContrato(user, contratoId);
  const tipo = String(formData.get("tipo") ?? "");
  const dataVigencia = new Date(String(formData.get("dataVigencia") ?? ""));
  const responsavelId = await internoAtivo(String(formData.get("responsavelId") || user.id), "o responsável");

  const { contrato: base, atual, temEtapaDeAssinatura } = await contratoComEtapas(contratoId);
  const contrato = { ...base, anexos: await prisma.anexo.findMany({ where: { contratoId } }) };

  if (!atual.liberaProjeto) {
    throw new Error(`O projeto só pode ser criado na etapa do fluxo que libera o projeto (o contrato está em "${atual.nome}").`);
  }
  if (temEtapaDeAssinatura && !contrato.fluxoAssinatura?.concluido) {
    throw new Error("O contrato precisa estar com todas as assinaturas coletadas para criar o projeto.");
  }
  if (!tipo || Number.isNaN(dataVigencia.getTime())) throw new Error("Tipo do projeto e data de vigência são obrigatórios.");

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
      dataVigencia,
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

// ---------- Documentos pedidos nas etapas do contrato ----------

async function avisarPrefeitura(contrato: { id: string; codigo: string; contratanteId: string }, mensagem: string) {
  const externos = await prisma.user.findMany({ where: { municipioId: contrato.contratanteId, tipo: "EXTERNO", ativo: true }, select: { id: true } });
  if (externos.length) {
    await prisma.notificacao.createMany({
      data: externos.map((u) => ({ userId: u.id, tipo: "ETAPA_AGUARDANDO_VOCE", mensagem, entidadeTipo: "Contrato", entidadeId: contrato.id })),
    });
  }
}

/** O CTP pede um documento a mais na etapa atual do contrato. */
export async function pedirDocumentoContrato(formData: FormData) {
  const user = await exigirPermissao("contrato.gerenciar");
  const contratoId = String(formData.get("contratoId"));
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 200);
  const enviaQuem = formData.get("enviaQuem") === "CTP" ? "CTP" : "PREFEITURA";
  if (!nome) throw new Error("Diga qual documento é pedido.");
  await assertVeContrato(user, contratoId);
  const contrato = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });

  await prisma.documentoContrato.create({ data: { contratoId, etapaChave: contrato.etapaAtual, nome, enviaQuem } });
  if (enviaQuem === "PREFEITURA") await avisarPrefeitura(contrato, `O CTP pediu o documento "${nome}" no contrato ${contrato.codigo}.`);
  await registrarAuditoria({ userId: user.id, acao: "PEDIR_DOCUMENTO", entidadeTipo: "Contrato", entidadeId: contratoId, detalhe: nome });
  revalidatePath(`/contratos/${contratoId}`);
}

/**
 * Envio do arquivo de um documento pedido. Da prefeitura: fica "em análise" até o CTP aprovar.
 * Do CTP (documento que cabe ao CTP, ou enviado pelo CTP em nome da prefeitura): já vale como aprovado.
 */
export async function enviarDocumentoContrato(formData: FormData) {
  const user = await requireSession();
  const documento = await prisma.documentoContrato.findUniqueOrThrow({ where: { id: String(formData.get("documentoId")) }, include: { contrato: true } });
  await assertVeContrato(user, documento.contratoId);
  if (documento.status === "APROVADO") throw new Error("Este documento já foi aprovado.");
  const interno = user.tipo === "INTERNO";
  if (interno) exigir(user, "contrato.gerenciar");
  else {
    if (documento.enviaQuem !== "PREFEITURA") throw new AcessoNegadoError("Este documento é enviado pelo CTP.");
    exigir(user, "etapa.enviar");
  }

  const file = formData.get("arquivo") as File | null;
  if (!file || file.size === 0) throw new Error("Selecione um arquivo.");
  const anexoId = await salvarAnexo(file);
  await prisma.$transaction([
    // Vincula o arquivo ao contrato: aparece na lista de documentos e herda o controle de acesso dele.
    prisma.anexo.update({ where: { id: anexoId }, data: { contratoId: documento.contratoId } }),
    prisma.documentoContrato.update({
      where: { id: documento.id },
      data: { anexoId, enviadoEm: new Date(), status: interno ? "APROVADO" : "ENVIADO", motivoRecusa: null },
    }),
  ]);

  if (!interno) {
    await prisma.notificacao.create({
      data: {
        userId: documento.contrato.responsavelId, tipo: "MUNICIPIO_RESPONDEU",
        mensagem: `O município enviou "${documento.nome}" no contrato ${documento.contrato.codigo}.`,
        entidadeTipo: "Contrato", entidadeId: documento.contratoId,
      },
    });
  }
  await registrarAuditoria({ userId: user.id, acao: "ENVIAR_DOCUMENTO", entidadeTipo: "DocumentoContrato", entidadeId: documento.id, detalhe: documento.nome });
  revalidatePath(`/contratos/${documento.contratoId}`);
}

export async function aprovarDocumentoContrato(documentoId: string) {
  const user = await exigirPermissao("contrato.gerenciar");
  const documento = await prisma.documentoContrato.findUniqueOrThrow({ where: { id: documentoId } });
  await assertVeContrato(user, documento.contratoId);
  if (documento.status !== "ENVIADO") throw new Error("Só dá para aprovar um documento já enviado.");
  await prisma.documentoContrato.update({ where: { id: documentoId }, data: { status: "APROVADO" } });
  await registrarAuditoria({ userId: user.id, acao: "APROVAR_DOCUMENTO", entidadeTipo: "DocumentoContrato", entidadeId: documentoId, detalhe: documento.nome });
  revalidatePath(`/contratos/${documento.contratoId}`);
}

/** Devolve o documento à prefeitura com o motivo; o arquivo recusado continua no histórico do contrato. */
export async function recusarDocumentoContrato(formData: FormData) {
  const user = await exigirPermissao("contrato.gerenciar");
  const documento = await prisma.documentoContrato.findUniqueOrThrow({ where: { id: String(formData.get("documentoId")) }, include: { contrato: true } });
  await assertVeContrato(user, documento.contratoId);
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 500);
  if (!motivo) throw new Error("Explique o motivo da recusa — a prefeitura vai ver.");
  if (documento.status !== "ENVIADO") throw new Error("Só dá para recusar um documento enviado e ainda não aprovado.");

  await prisma.documentoContrato.update({ where: { id: documento.id }, data: { status: "PENDENTE", anexoId: null, motivoRecusa: motivo } });
  await avisarPrefeitura(documento.contrato, `O CTP pediu um novo envio de "${documento.nome}" (contrato ${documento.contrato.codigo}): ${motivo}`);
  await registrarAuditoria({ userId: user.id, acao: "RECUSAR_DOCUMENTO", entidadeTipo: "DocumentoContrato", entidadeId: documento.id, detalhe: motivo });
  revalidatePath(`/contratos/${documento.contratoId}`);
}

/** Tira da lista um documento que não será mais pedido (só enquanto não houver arquivo). */
export async function removerDocumentoContrato(documentoId: string) {
  const user = await exigirPermissao("contrato.gerenciar");
  const documento = await prisma.documentoContrato.findUniqueOrThrow({ where: { id: documentoId } });
  await assertVeContrato(user, documento.contratoId);
  if (documento.anexoId) throw new Error("Este documento já tem arquivo enviado; recuse-o em vez de remover.");
  await prisma.documentoContrato.delete({ where: { id: documentoId } });
  await registrarAuditoria({ userId: user.id, acao: "REMOVER_DOCUMENTO", entidadeTipo: "DocumentoContrato", entidadeId: documentoId, detalhe: documento.nome });
  revalidatePath(`/contratos/${documento.contratoId}`);
}