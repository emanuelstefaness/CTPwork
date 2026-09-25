"use server";

import { prisma } from "@/lib/prisma";
import { requireSession, requireGestor, assertAcessoContratante, AcessoNegadoError } from "@/lib/tenant";
import { registrarAuditoria } from "@/lib/audit";
import { salvarAnexo } from "@/lib/storage";
import { revalidatePath } from "next/cache";

async function getEtapaComProjeto(etapaId: string) {
  const etapa = await prisma.etapaProjeto.findUniqueOrThrow({
    where: { id: etapaId },
    include: { projeto: true },
  });
  return etapa;
}

async function assertAcessoEtapa(etapaId: string) {
  const user = await requireSession();
  const etapa = await getEtapaComProjeto(etapaId);
  assertAcessoContratante(user, etapa.projeto.contratanteId);
  return { user, etapa };
}

/** Máquina 6.3, regra obrigatória 10.2: notifica automaticamente ao entrar em Aguardando município / ao ele responder. */
export async function avancarStatusEtapa(etapaId: string, novoStatus: string) {
  const { user, etapa } = await assertAcessoEtapa(etapaId);
  if (user.tipo !== "INTERNO") throw new AcessoNegadoError("Apenas CTP altera o status da etapa.");
  if (!["NAO_INICIADA", "EM_ANDAMENTO", "AGUARDANDO_MUNICIPIO", "CONCLUIDA"].includes(novoStatus)) throw new Error("Status inválido.");
  // Etapa com documento só conclui por concluirEtapaComRevisao (que exige o parecer do município).
  if (novoStatus === "CONCLUIDA" && etapa.temRevisao) throw new Error('Use "Concluir revisão" para encerrar uma etapa com documento.');

  await prisma.etapaProjeto.update({ where: { id: etapaId }, data: { status: novoStatus } });

  if (novoStatus === "AGUARDANDO_MUNICIPIO") {
    // Todos os usuários do município — antes só o primeiro cadastrado era avisado.
    const externos = await prisma.user.findMany({ where: { municipioId: etapa.projeto.contratanteId, tipo: "EXTERNO", ativo: true }, select: { id: true } });
    if (externos.length) {
      await prisma.notificacao.createMany({
        data: externos.map((u) => ({
          userId: u.id,
          tipo: "ETAPA_AGUARDANDO_VOCE",
          mensagem: `A etapa "${etapa.nome}" do projeto ${etapa.projeto.codigo} está aguardando sua resposta.`,
          entidadeTipo: "EtapaProjeto",
          entidadeId: etapaId,
        })),
      });
    }
  }

  await registrarAuditoria({ userId: user.id, acao: "MUDAR_STATUS_ETAPA", entidadeTipo: "EtapaProjeto", entidadeId: etapaId, detalhe: novoStatus });
  revalidatePath(`/projetos/${etapa.projetoId}`);
}

/** Notifica o responsável interno quando o município responde (formulário ou checklist). */
async function notificarRespostaMunicipio(etapaId: string, mensagem: string) {
  const etapa = await getEtapaComProjeto(etapaId);
  await prisma.notificacao.create({
    data: {
      userId: etapa.responsavelId,
      tipo: "MUNICIPIO_RESPONDEU",
      mensagem,
      entidadeTipo: "EtapaProjeto",
      entidadeId: etapaId,
    },
  });
}

export async function responderFormularioEtapa(formData: FormData) {
  const etapaId = String(formData.get("etapaId"));
  const { user, etapa } = await assertAcessoEtapa(etapaId);
  if (user.tipo !== "EXTERNO") throw new AcessoNegadoError("Só o usuário do município responde este formulário.");

  const modelo = await prisma.modeloFormulario.findFirst({ where: { tipo: "CONTRATO" } });
  const respostas: Record<string, string> = {};
  if (modelo) {
    const campos = JSON.parse(modelo.campos) as { chave: string; obrigatorio: boolean }[];
    for (const campo of campos) {
      const v = String(formData.get(campo.chave) ?? "").trim();
      if (campo.obrigatorio && !v) throw new Error(`Campo obrigatório ausente: ${campo.chave}`);
      respostas[campo.chave] = v;
    }
  }

  await prisma.formularioResposta.upsert({
    where: { etapaId },
    update: { respostas: JSON.stringify(respostas) },
    create: { etapaId, respostas: JSON.stringify(respostas), enviadoPorId: user.id },
  });

  await notificarRespostaMunicipio(etapaId, `O município respondeu o formulário da etapa "${etapa.nome}".`);
  await registrarAuditoria({ userId: user.id, acao: "RESPONDER_FORMULARIO", entidadeTipo: "EtapaProjeto", entidadeId: etapaId });
  revalidatePath(`/projetos/${etapa.projetoId}`);
}

/** Alimenta a aba de prazos consolidada (8.3). */
export async function definirPrazoEtapa(formData: FormData) {
  const etapaId = String(formData.get("etapaId"));
  const { user, etapa } = await assertAcessoEtapa(etapaId);
  if (user.tipo !== "INTERNO") throw new AcessoNegadoError("Apenas CTP define prazos.");

  const prazoRaw = String(formData.get("prazo") ?? "");
  await prisma.etapaProjeto.update({
    where: { id: etapaId },
    data: { prazo: prazoRaw ? new Date(prazoRaw) : null },
  });
  revalidatePath(`/projetos/${etapa.projetoId}`);
}

export async function criarItemChecklist(formData: FormData) {
  const etapaId = String(formData.get("etapaId"));
  const { user, etapa } = await assertAcessoEtapa(etapaId);
  if (user.tipo !== "INTERNO") throw new AcessoNegadoError("Apenas CTP cria itens de checklist.");

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome do item é obrigatório.");

  await prisma.checklistItem.create({ data: { etapaId, nome, status: "PENDENTE" } });
  revalidatePath(`/projetos/${etapa.projetoId}`);
}

export async function enviarArquivoChecklist(formData: FormData) {
  const itemId = String(formData.get("itemId"));
  const item = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
  const { user, etapa } = await assertAcessoEtapa(item.etapaId);
  if (user.tipo !== "EXTERNO") throw new AcessoNegadoError("Só o município envia documentos do checklist.");

  const file = formData.get("arquivo") as File | null;
  if (!file || file.size === 0) throw new Error("Selecione um arquivo.");

  const arquivoId = await salvarAnexo(file);
  await prisma.checklistItem.update({ where: { id: itemId }, data: { status: "ENVIADO", arquivoId } });

  await notificarRespostaMunicipio(item.etapaId, `O município enviou o documento "${item.nome}" na etapa "${etapa.nome}".`);
  await registrarAuditoria({ userId: user.id, acao: "ENVIAR_CHECKLIST", entidadeTipo: "ChecklistItem", entidadeId: itemId });
  revalidatePath(`/projetos/${etapa.projetoId}`);
}

export async function aprovarItemChecklist(itemId: string) {
  const item = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
  const { user, etapa } = await assertAcessoEtapa(item.etapaId);
  if (user.tipo !== "INTERNO") throw new AcessoNegadoError("Apenas CTP aprova itens de checklist.");

  await prisma.checklistItem.update({ where: { id: itemId }, data: { status: "APROVADO" } });
  await registrarAuditoria({ userId: user.id, acao: "APROVAR_CHECKLIST", entidadeTipo: "ChecklistItem", entidadeId: itemId });
  revalidatePath(`/projetos/${etapa.projetoId}`);
}

/** Regra 10.3: bloqueia conclusão da etapa de minuta enquanto houver unidade Pendente. */
export async function concluirEtapaComRevisao(etapaId: string) {
  const { user, etapa } = await assertAcessoEtapa(etapaId);
  if (user.tipo !== "INTERNO") throw new AcessoNegadoError("Apenas CTP conclui a etapa.");

  // Só a versão mais recente enviada conta: versões antigas substituídas não bloqueiam.
  const ultimaEnviada = await prisma.documentoVersionado.findFirst({
    where: { etapaId, enviadoEm: { not: null } },
    orderBy: { versao: "desc" },
  });
  if (!ultimaEnviada) throw new Error("Envie o documento ao município antes de concluir a revisão.");
  const pendentes = await prisma.unidadeRevisao.count({
    where: { documentoId: ultimaEnviada.id, tipo: "DOCUMENTO_INTEIRO", status: "PENDENTE" },
  });
  if (pendentes > 0) {
    throw new Error(`A versão ${ultimaEnviada.versao} ainda aguarda avaliação do município. Conclusão bloqueada.`);
  }

  await prisma.etapaProjeto.update({ where: { id: etapaId }, data: { status: "CONCLUIDA" } });
  await registrarAuditoria({ userId: user.id, acao: "CONCLUIR_ETAPA", entidadeTipo: "EtapaProjeto", entidadeId: etapaId });
  revalidatePath(`/projetos/${etapa.projetoId}`);
}

/** Chat 8.2: mensagens imutáveis após envio, visíveis a CTP e ao usuário externo vinculado à etapa. */
export async function enviarMensagemChat(formData: FormData) {
  const etapaId = String(formData.get("etapaId"));
  const { user, etapa } = await assertAcessoEtapa(etapaId);

  const texto = String(formData.get("texto") ?? "").trim();
  const file = formData.get("arquivo") as File | null;
  if (!texto && (!file || file.size === 0)) throw new Error("Escreva uma mensagem ou anexe um arquivo.");

  let anexoId: string | null = null;
  if (file && file.size > 0) anexoId = await salvarAnexo(file);

  await prisma.mensagemChat.create({
    data: { etapaId, autorId: user.id, texto: texto || "(anexo)", anexoId },
  });

  // Avisa o outro lado. Município escreveu → responsável da etapa + quem do CTP já falou no chat;
  // CTP escreveu → todos os usuários do município. Quem já tem aviso não lido deste chat não ganha outro.
  const destinatarios =
    user.tipo === "INTERNO"
      ? await prisma.user.findMany({ where: { municipioId: etapa.projeto.contratanteId, tipo: "EXTERNO", ativo: true }, select: { id: true } })
      : await prisma.user.findMany({
          where: { tipo: "INTERNO", ativo: true, OR: [{ id: etapa.responsavelId }, { mensagens: { some: { etapaId } } }] },
          select: { id: true },
        });
  const ids = destinatarios.map((d) => d.id).filter((id) => id !== user.id);
  if (ids.length) {
    const jaAvisados = new Set(
      (await prisma.notificacao.findMany({
        where: { userId: { in: ids }, tipo: "NOVA_MENSAGEM", entidadeTipo: "EtapaProjeto", entidadeId: etapaId, lida: false },
        select: { userId: true },
      })).map((n) => n.userId),
    );
    const resumo = (texto || "enviou um arquivo").slice(0, 80);
    const novos = ids.filter((id) => !jaAvisados.has(id));
    if (novos.length) {
      await prisma.notificacao.createMany({
        data: novos.map((userId) => ({
          userId,
          tipo: "NOVA_MENSAGEM",
          mensagem: `${user.tipo === "INTERNO" ? "O CTP" : user.name ?? "O município"} escreveu no chat da etapa "${etapa.nome}" (${etapa.projeto.codigo}): ${resumo}`,
          entidadeTipo: "EtapaProjeto",
          entidadeId: etapaId,
        })),
      });
    }
  }
  revalidatePath(`/projetos/${etapa.projetoId}`);
}

/** 9.5: reabertura apenas por Gestor, com auditoria de motivo. */
export async function reabrirEtapa(formData: FormData) {
  const user = await requireGestor();
  const etapaId = String(formData.get("etapaId"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) throw new Error("Informe o motivo da reabertura.");

  const etapa = await prisma.etapaProjeto.findUniqueOrThrow({ where: { id: etapaId } });
  await prisma.etapaProjeto.update({ where: { id: etapaId }, data: { status: "EM_ANDAMENTO" } });
  await registrarAuditoria({ userId: user.id, acao: "REABRIR_ETAPA", entidadeTipo: "EtapaProjeto", entidadeId: etapaId, detalhe: motivo });
  revalidatePath(`/projetos/${etapa.projetoId}`);
}
