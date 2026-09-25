"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertAcessoContratante, type SessaoAtual } from "@/lib/tenant";
import { capturar, ErroUsuario, type Resultado } from "@/lib/resultado";
import { registrarAuditoria } from "@/lib/audit";
import { salvarAnexo } from "@/lib/storage";

/**
 * Conversas com o município que não pertencem a uma etapa de projeto (o chat da etapa continua
 * existindo para o que é da etapa). Devolvem { ok, erro } — ver src/lib/resultado.ts.
 */

async function carregarConversa(conversaId: string) {
  const user = await requireSession();
  const conversa = await prisma.conversa.findUnique({ where: { id: conversaId } });
  if (!conversa) throw new ErroUsuario("Conversa não encontrada.");
  assertAcessoContratante(user, conversa.municipioId);
  return { user, conversa };
}

function lerTexto(formData: FormData, campo: string, max: number) {
  return String(formData.get(campo) ?? "").trim().slice(0, max);
}

async function anexoDoFormulario(formData: FormData) {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return null;
  return salvarAnexo(arquivo);
}

/**
 * Quem recebe o aviso de mensagem nova: sempre o outro lado.
 * - CTP escreveu → todos os usuários do município.
 * - Município escreveu → quem do CTP já participa da conversa; se ninguém ainda, os responsáveis
 *   pelo contrato/projeto citado, depois os responsáveis pelos contratos do município e, por
 *   último, os gestores — nenhuma mensagem do município fica sem destinatário.
 */
async function destinatarios(conversa: { id: string; municipioId: string; contratoId: string | null; projetoId: string | null; criadoPorId: string }, autor: SessaoAtual) {
  if (autor.tipo === "INTERNO") {
    const externos = await prisma.user.findMany({ where: { municipioId: conversa.municipioId, tipo: "EXTERNO", ativo: true }, select: { id: true } });
    return externos.map((u) => u.id);
  }
  const participantes = await prisma.user.findMany({
    where: {
      tipo: "INTERNO",
      ativo: true,
      OR: [{ id: conversa.criadoPorId }, { mensagensConversa: { some: { conversaId: conversa.id } } }],
    },
    select: { id: true },
  });
  if (participantes.length) return participantes.map((u) => u.id);

  const vinculados = new Set<string>();
  if (conversa.contratoId) {
    const c = await prisma.contrato.findUnique({ where: { id: conversa.contratoId }, select: { responsavelId: true } });
    if (c) vinculados.add(c.responsavelId);
  }
  if (conversa.projetoId) {
    const p = await prisma.projeto.findUnique({ where: { id: conversa.projetoId }, select: { responsavelId: true } });
    if (p) vinculados.add(p.responsavelId);
  }
  if (vinculados.size) return [...vinculados];

  const doMunicipio = await prisma.contrato.findMany({ where: { contratanteId: conversa.municipioId }, select: { responsavelId: true }, distinct: ["responsavelId"] });
  if (doMunicipio.length) return doMunicipio.map((c) => c.responsavelId);

  const gestores = await prisma.user.findMany({ where: { tipo: "INTERNO", perfilInterno: "GESTOR", ativo: true }, select: { id: true } });
  return gestores.map((u) => u.id);
}

/** Avisa o outro lado — sem empilhar: quem ainda tem um aviso não lido desta conversa não ganha outro. */
async function notificar(conversa: Parameters<typeof destinatarios>[0] & { assunto: string }, autor: SessaoAtual, mensagem: string) {
  const ids = (await destinatarios(conversa, autor)).filter((id) => id !== autor.id);
  if (!ids.length) return;
  const jaAvisados = await prisma.notificacao.findMany({
    where: { userId: { in: ids }, entidadeTipo: "Conversa", entidadeId: conversa.id, lida: false },
    select: { userId: true },
  });
  const pular = new Set(jaAvisados.map((n) => n.userId));
  const novos = ids.filter((id) => !pular.has(id));
  if (!novos.length) return;
  await prisma.notificacao.createMany({
    data: novos.map((userId) => ({ userId, tipo: "NOVA_MENSAGEM", mensagem, entidadeTipo: "Conversa", entidadeId: conversa.id })),
  });
}

const resumo = (texto: string) => (texto.length > 80 ? `${texto.slice(0, 80)}…` : texto);

export async function iniciarConversa(formData: FormData): Promise<Resultado<{ id: string }>> {
  return capturar(async () => {
    const user = await requireSession();
    const municipioId = user.tipo === "EXTERNO" ? user.municipioId : lerTexto(formData, "municipioId", 100);
    if (!municipioId) throw new ErroUsuario("Escolha o município.");
    assertAcessoContratante(user, municipioId);
    const municipio = await prisma.municipio.findUnique({ where: { id: municipioId } });
    if (!municipio) throw new ErroUsuario("Município não encontrado.");

    const assunto = lerTexto(formData, "assunto", 160);
    const texto = lerTexto(formData, "texto", 10000);
    if (!assunto) throw new ErroUsuario("Informe o assunto da conversa.");
    if (!texto) throw new ErroUsuario("Escreva a primeira mensagem.");

    // Vínculo opcional: "contrato:<id>" ou "projeto:<id>" — sempre do mesmo município.
    const vinculo = lerTexto(formData, "vinculo", 120);
    let contratoId: string | null = null;
    let projetoId: string | null = null;
    if (vinculo.startsWith("contrato:")) {
      const c = await prisma.contrato.findUnique({ where: { id: vinculo.slice(9) } });
      if (!c || c.contratanteId !== municipioId) throw new ErroUsuario("O contrato escolhido não é deste município.");
      contratoId = c.id;
    } else if (vinculo.startsWith("projeto:")) {
      const p = await prisma.projeto.findUnique({ where: { id: vinculo.slice(8) } });
      if (!p || p.contratanteId !== municipioId) throw new ErroUsuario("O projeto escolhido não é deste município.");
      projetoId = p.id;
      contratoId = p.contratoOrigemId;
    }

    const anexoId = await anexoDoFormulario(formData);
    const agora = new Date();
    const conversa = await prisma.conversa.create({
      data: {
        municipioId,
        assunto,
        contratoId,
        projetoId,
        criadoPorId: user.id,
        ultimaMensagemEm: agora,
        mensagens: { create: { autorId: user.id, texto, anexoId, createdAt: agora } },
        leituras: { create: { userId: user.id, lidoEm: agora } },
      },
    });

    await notificar(
      conversa,
      user,
      user.tipo === "INTERNO"
        ? `O CTP iniciou a conversa "${assunto}": ${resumo(texto)}`
        : `${municipio.nome} iniciou a conversa "${assunto}": ${resumo(texto)}`,
    );
    await registrarAuditoria({ userId: user.id, acao: "INICIAR_CONVERSA", entidadeTipo: "Conversa", entidadeId: conversa.id, detalhe: assunto });
    revalidatePath("/conversas");
    redirect(`/conversas/${conversa.id}`);
  });
}

export async function enviarMensagemConversa(formData: FormData): Promise<Resultado> {
  return capturar(async () => {
    const { user, conversa } = await carregarConversa(lerTexto(formData, "conversaId", 100));
    const texto = lerTexto(formData, "texto", 10000);
    const anexoId = await anexoDoFormulario(formData);
    if (!texto && !anexoId) throw new ErroUsuario("Escreva uma mensagem ou anexe um arquivo.");

    const agora = new Date();
    await prisma.$transaction([
      prisma.mensagemConversa.create({ data: { conversaId: conversa.id, autorId: user.id, texto: texto || "(arquivo anexado)", anexoId, createdAt: agora } }),
      // Escrever numa conversa encerrada a reabre — como responder um chamado fechado.
      prisma.conversa.update({ where: { id: conversa.id }, data: { ultimaMensagemEm: agora, status: "ABERTA" } }),
      prisma.leituraConversa.upsert({
        where: { conversaId_userId: { conversaId: conversa.id, userId: user.id } },
        update: { lidoEm: agora },
        create: { conversaId: conversa.id, userId: user.id, lidoEm: agora },
      }),
    ]);

    const municipio = user.tipo === "EXTERNO" ? await prisma.municipio.findUnique({ where: { id: conversa.municipioId }, select: { nome: true } }) : null;
    await notificar(
      conversa,
      user,
      `${user.tipo === "INTERNO" ? "O CTP" : municipio?.nome ?? "O município"} respondeu em "${conversa.assunto}": ${resumo(texto || "enviou um arquivo")}`,
    );
    revalidatePath(`/conversas/${conversa.id}`);
    revalidatePath("/conversas");
    return undefined;
  });
}

export async function alterarStatusConversa(conversaId: string, status: "ABERTA" | "ENCERRADA"): Promise<Resultado> {
  return capturar(async () => {
    const { user, conversa } = await carregarConversa(conversaId);
    if (status !== "ABERTA" && status !== "ENCERRADA") throw new ErroUsuario("Status inválido.");
    if (conversa.status === status) return undefined;
    await prisma.conversa.update({ where: { id: conversaId }, data: { status } });
    await registrarAuditoria({ userId: user.id, acao: status === "ENCERRADA" ? "ENCERRAR_CONVERSA" : "REABRIR_CONVERSA", entidadeTipo: "Conversa", entidadeId: conversaId });
    revalidatePath(`/conversas/${conversaId}`);
    revalidatePath("/conversas");
    return undefined;
  });
}
