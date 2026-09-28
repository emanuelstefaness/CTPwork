"use server";

import mammoth from "mammoth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertAcessoContratante, AcessoNegadoError, exigir, type SessaoAtual } from "@/lib/tenant";
import { pode } from "@/lib/permissoes";
import { assertVeProjeto } from "@/lib/visibilidade";
import { capturar, ErroUsuario, type Resultado } from "@/lib/resultado";
import { registrarAuditoria } from "@/lib/audit";
import { lerDocumento, normalizarConteudo } from "@/lib/editor/servidor";
import { ancoraValida, textoDoTrecho } from "@/lib/editor/ancoras";
import { CORES_GRIFO, TIPO_ANOTACAO_LABEL, limparSugestao, type DecisaoSugestao, type TipoAnotacao } from "@/lib/editor/extensoes";

/**
 * Fluxo do documento editado dentro do sistema:
 *   CTP edita um RASCUNHO (só o CTP vê) → "Enviar ao município" congela como versão N →
 *   município confirma a leitura, grifa/comenta/concorda/discorda por trecho e aprova ou pede
 *   ajustes → CTP responde/resolve e cria a versão N+1 a partir da N.
 *
 * Estas actions DEVOLVEM { ok, erro } em vez de lançar: em build de produção o Next esconde a
 * mensagem de erros lançados por server actions, e aqui a mensagem é o que orienta o usuário.
 */

export type { Resultado } from "@/lib/resultado";

const executar = capturar;


async function carregarDocumento(documentoId: string) {
  const user = await requireSession();
  const documento = await prisma.documentoVersionado.findUnique({
    where: { id: documentoId },
    include: { etapa: { include: { projeto: true } } },
  });
  if (!documento) throw new ErroUsuario("Documento não encontrado.");
  assertAcessoContratante(user, documento.etapa.projeto.contratanteId);
  await assertVeProjeto(user, documento.etapa.projetoId);
  // Rascunho é interno: o município nunca enxerga uma versão que o CTP ainda não enviou.
  if (!documento.enviadoEm && user.tipo !== "INTERNO") throw new AcessoNegadoError("Documento não disponível.");
  return { user, documento, etapa: documento.etapa };
}

/** Escrever/enviar minutas e decidir sobre sugestões: permissão "Escrever minutas" do perfil. */
function exigirInterno(user: SessaoAtual, msg?: string) {
  if (!pode(user, "minuta.escrever")) throw new AcessoNegadoError(msg ?? `Seu perfil (${user.perfilNome}) não permite escrever minutas.`);
}

async function usuariosDoMunicipio(municipioId: string) {
  return prisma.user.findMany({ where: { municipioId, tipo: "EXTERNO", ativo: true }, select: { id: true } });
}

/* ───────────────────────────── Rascunho (edição pelo CTP) ───────────────────────────── */

/** Abre um rascunho para a etapa: cópia da última versão enviada, ou documento em branco. */
export async function criarRascunho(etapaId: string): Promise<Resultado<{ id: string }>> {
  return executar(async () => {
    const user = await requireSession();
    exigirInterno(user);
    const etapa = await prisma.etapaProjeto.findUnique({ where: { id: etapaId }, include: { projeto: true } });
    if (!etapa) throw new ErroUsuario("Etapa não encontrada.");
    if (!etapa.temRevisao) throw new ErroUsuario("Esta etapa não tem documento para revisão.");

    const existente = await prisma.documentoVersionado.findFirst({ where: { etapaId, enviadoEm: null } });
    if (existente) return { id: existente.id };

    const ultima = await prisma.documentoVersionado.findFirst({ where: { etapaId }, orderBy: { versao: "desc" } });
    const base = await prisma.documentoVersionado.findFirst({ where: { etapaId, conteudo: { not: null } }, orderBy: { versao: "desc" } });
    const versao = (ultima?.versao ?? 0) + 1;
    const titulo = base?.titulo ?? `Minuta — ${etapa.nome}`;

    const doc = await prisma.documentoVersionado.create({
      data: { etapaId, versao, titulo, nomeArquivo: `${titulo} (v${versao})`, conteudo: base?.conteudo ?? null, criadoPorId: user.id },
    });
    await registrarAuditoria({ userId: user.id, acao: "CRIAR_RASCUNHO", entidadeTipo: "DocumentoVersionado", entidadeId: doc.id, detalhe: `v${versao}` });
    revalidatePath(`/projetos/${etapa.projetoId}`);
    return { id: doc.id };
  });
}

/**
 * Salvamento automático do rascunho. Junto com o texto vêm as posições atuais das anotações
 * internas do rascunho (o editor as desloca conforme o texto muda); anotação cujo trecho foi
 * apagado fica com de = ate = 0 ("trecho removido").
 */
export async function salvarRascunho(
  documentoId: string,
  /** JSON do editor serializado: os attrs do ProseMirror não são objetos simples e o Next não os transporta. */
  conteudo: string,
  titulo: string,
  posicoes: { id: string; de: number; ate: number }[],
): Promise<Resultado<{ salvoEm: string }>> {
  return executar(async () => {
    const { user, documento } = await carregarDocumento(documentoId);
    exigirInterno(user);
    if (documento.enviadoEm) throw new ErroUsuario("Esta versão já foi enviada ao município e não pode mais ser alterada.");

    let bruto: unknown;
    try {
      bruto = JSON.parse(conteudo);
    } catch {
      throw new ErroUsuario("Conteúdo inválido.");
    }
    const json = normalizarConteudo(bruto);
    const doc = lerDocumento(json);
    const tituloLimpo = titulo.trim().slice(0, 160) || "Documento sem título";
    const anotacoes = await prisma.anotacaoDocumento.findMany({ where: { documentoId }, select: { id: true } });
    const porId = new Map(posicoes.map((p) => [p.id, p]));

    await prisma.$transaction([
      prisma.documentoVersionado.update({
        where: { id: documentoId },
        data: { conteudo: json, titulo: tituloLimpo, nomeArquivo: `${tituloLimpo} (v${documento.versao})` },
      }),
      ...anotacoes.map((a) => {
        const p = porId.get(a.id);
        const valida = p && p.ate > p.de && p.ate <= doc.content.size;
        return prisma.anotacaoDocumento.update({
          where: { id: a.id },
          data: valida ? { de: p.de, ate: p.ate, trecho: textoDoTrecho(doc, p.de, p.ate) } : { de: 0, ate: 0 },
        });
      }),
    ]);
    return { salvoEm: new Date().toISOString() };
  });
}

export async function descartarRascunho(documentoId: string): Promise<Resultado> {
  return executar(async () => {
    const { user, documento, etapa } = await carregarDocumento(documentoId);
    exigirInterno(user);
    if (documento.enviadoEm) throw new ErroUsuario("Versões enviadas não podem ser descartadas.");
    await prisma.documentoVersionado.delete({ where: { id: documentoId } });
    await registrarAuditoria({ userId: user.id, acao: "DESCARTAR_RASCUNHO", entidadeTipo: "DocumentoVersionado", entidadeId: documentoId, detalhe: `v${documento.versao}` });
    revalidatePath(`/projetos/${etapa.projetoId}`);
    return undefined;
  });
}

/** Congela o rascunho como versão enviada e passa a vez ao município. */
export async function enviarVersao(documentoId: string): Promise<Resultado> {
  return executar(async () => {
    const { user, documento, etapa } = await carregarDocumento(documentoId);
    exigirInterno(user);
    if (documento.enviadoEm) throw new ErroUsuario("Esta versão já foi enviada.");
    const doc = lerDocumento(documento.conteudo);
    if (doc.textContent.trim().length < 20) throw new ErroUsuario("O documento está vazio. Escreva ou importe o conteúdo antes de enviar.");

    await prisma.$transaction([
      prisma.documentoVersionado.update({ where: { id: documentoId }, data: { enviadoEm: new Date() } }),
      prisma.unidadeRevisao.create({
        data: { documentoId, tipo: "DOCUMENTO_INTEIRO", identificador: "documento_inteiro", autorId: user.id },
      }),
      prisma.etapaProjeto.update({ where: { id: etapa.id }, data: { status: "AGUARDANDO_MUNICIPIO" } }),
    ]);

    const destinatarios = await usuariosDoMunicipio(etapa.projeto.contratanteId);
    if (destinatarios.length > 0) {
      await prisma.notificacao.createMany({
        data: destinatarios.map((d) => ({
          userId: d.id,
          tipo: "ETAPA_AGUARDANDO_VOCE",
          mensagem: `O CTP enviou a versão ${documento.versao} de "${documento.titulo ?? "documento"}" (${etapa.projeto.codigo}) para sua revisão.`,
          entidadeTipo: "EtapaProjeto",
          entidadeId: etapa.id,
        })),
      });
    }
    await registrarAuditoria({ userId: user.id, acao: "ENVIAR_MINUTA", entidadeTipo: "EtapaProjeto", entidadeId: etapa.id, detalhe: `v${documento.versao}` });
    revalidatePath(`/projetos/${etapa.projetoId}`);
    return undefined;
  });
}

/** Converte um .docx em HTML para o editor carregar (títulos, listas, tabelas, negrito, itálico). */
export async function importarDocx(formData: FormData): Promise<Resultado<{ html: string; avisos: number }>> {
  return executar(async () => {
    const user = await requireSession();
    exigirInterno(user);
    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) throw new ErroUsuario("Selecione um arquivo .docx.");
    if (!arquivo.name.toLowerCase().endsWith(".docx")) {
      throw new ErroUsuario("Formato não suportado. Salve o arquivo como .docx (Word 2007 ou mais recente) e tente de novo.");
    }
    if (arquivo.size > 15 * 1024 * 1024) throw new ErroUsuario("O arquivo excede 15 MB.");
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const resultado = await mammoth.convertToHtml({ buffer }, { ignoreEmptyParagraphs: true });
    // Imagens embutidas não fazem parte do esquema do documento; removidas para não pesar o JSON.
    const html = resultado.value.replace(/<img[^>]*>/g, "");
    if (!html.trim()) throw new ErroUsuario("Não encontramos texto nesse arquivo.");
    return { html, avisos: resultado.messages.length };
  });
}

/* ───────────────────────────── Anotações (grifo, comentário, posição) ───────────────────────────── */

const TIPOS: TipoAnotacao[] = ["GRIFO", "COMENTARIO", "CONCORDO", "DISCORDO", "SUGESTAO"];

export async function criarAnotacao(input: {
  documentoId: string;
  de: number;
  ate: number;
  trecho: string;
  tipo: TipoAnotacao;
  cor?: string;
  texto?: string;
  /** Só SUGESTAO: a nova redação do trecho ("" = suprimir). */
  sugestao?: string;
}): Promise<Resultado<{ id: string }>> {
  return executar(async () => {
    const { user, documento, etapa } = await carregarDocumento(input.documentoId);
    const texto = input.texto?.trim() || null;
    if (!TIPOS.includes(input.tipo)) throw new ErroUsuario("Tipo de anotação inválido.");
    if ((input.tipo === "COMENTARIO" || input.tipo === "DISCORDO") && !texto) {
      throw new ErroUsuario(input.tipo === "DISCORDO" ? "Explique por que discorda deste trecho." : "Escreva o comentário.");
    }
    const cor = input.tipo === "GRIFO" ? (CORES_GRIFO.some((c) => c.chave === input.cor) ? input.cor! : "amarelo") : null;

    let sugestao: string | null = null;
    if (input.tipo === "SUGESTAO") {
      // O CTP muda o texto direto no rascunho; sugerir redação é a forma do município propor texto.
      if (user.tipo !== "EXTERNO") throw new ErroUsuario("A equipe do CTP altera o texto diretamente no rascunho da próxima versão.");
      sugestao = limparSugestao(input.sugestao ?? "").slice(0, 8000);
      if (sugestao.replace(/\s+/g, " ") === input.trecho.replace(/\s+/g, " ").trim()) {
        throw new ErroUsuario("A redação sugerida está igual ao texto atual. Altere o texto ou use Comentar.");
      }
    }

    if (user.tipo === "EXTERNO") {
      exigir(user, "minuta.revisar");
      const ultimaEnviada = await prisma.documentoVersionado.findFirst({ where: { etapaId: etapa.id, enviadoEm: { not: null } }, orderBy: { versao: "desc" } });
      if (ultimaEnviada?.id !== documento.id) throw new ErroUsuario("Só é possível anotar a versão mais recente do documento.");
      const leu = await prisma.visualizacaoDocumento.findUnique({ where: { documentoId_userId: { documentoId: documento.id, userId: user.id } } });
      if (!leu) throw new ErroUsuario("Confirme a leitura do documento antes de grifar ou comentar.");
    }

    const doc = lerDocumento(documento.conteudo);
    if (!ancoraValida(doc, input.de, input.ate, input.trecho)) {
      throw new ErroUsuario("O trecho selecionado não confere com o documento salvo. Recarregue a página e selecione de novo.");
    }

    const anotacao = await prisma.anotacaoDocumento.create({
      data: {
        documentoId: documento.id,
        autorId: user.id,
        de: input.de,
        ate: input.ate,
        trecho: textoDoTrecho(doc, input.de, input.ate).slice(0, 2000),
        tipo: input.tipo,
        cor,
        texto,
        sugestao,
      },
    });

    // Notificação só para quem precisa agir, e nunca por anotações em rascunho interno.
    if (documento.enviadoEm) {
      const rotulo = TIPO_ANOTACAO_LABEL[input.tipo].toLowerCase();
      const citacao = anotacao.trecho.length > 60 ? `${anotacao.trecho.slice(0, 60)}…` : anotacao.trecho;
      if (user.tipo === "EXTERNO") {
        await prisma.notificacao.create({
          data: {
            userId: etapa.responsavelId,
            tipo: "MUNICIPIO_RESPONDEU",
            mensagem: `${user.name ?? "O município"} registrou "${rotulo}" em "${citacao}" (v${documento.versao}, etapa "${etapa.nome}").`,
            entidadeTipo: "EtapaProjeto",
            entidadeId: etapa.id,
          },
        });
      } else if (input.tipo !== "GRIFO") {
        const destinatarios = await usuariosDoMunicipio(etapa.projeto.contratanteId);
        if (destinatarios.length) {
          await prisma.notificacao.createMany({
            data: destinatarios.map((d) => ({
              userId: d.id,
              tipo: "CTP_COMENTOU",
              mensagem: `O CTP comentou "${citacao}" na versão ${documento.versao} (etapa "${etapa.nome}").`,
              entidadeTipo: "EtapaProjeto",
              entidadeId: etapa.id,
            })),
          });
        }
      }
    }

    await registrarAuditoria({ userId: user.id, acao: "COMENTAR_TRECHO", entidadeTipo: "AnotacaoDocumento", entidadeId: anotacao.id, detalhe: input.tipo });
    revalidatePath(`/projetos/${etapa.projetoId}`);
    return { id: anotacao.id };
  });
}

export async function responderAnotacao(anotacaoId: string, texto: string): Promise<Resultado> {
  return executar(async () => {
    const limpo = texto.trim();
    if (!limpo) throw new ErroUsuario("Escreva a resposta.");
    const anotacao = await prisma.anotacaoDocumento.findUnique({ where: { id: anotacaoId } });
    if (!anotacao) throw new ErroUsuario("Anotação não encontrada.");
    const { user, documento, etapa } = await carregarDocumento(anotacao.documentoId);
    if (user.tipo === "EXTERNO") {
      exigir(user, "minuta.revisar");
      const leu = await prisma.visualizacaoDocumento.findUnique({ where: { documentoId_userId: { documentoId: documento.id, userId: user.id } } });
      if (!leu) throw new ErroUsuario("Confirme a leitura do documento antes de responder.");
    }

    await prisma.respostaAnotacao.create({ data: { anotacaoId, autorId: user.id, texto: limpo.slice(0, 4000) } });
    if (anotacao.autorId !== user.id && documento.enviadoEm) {
      await prisma.notificacao.create({
        data: {
          userId: anotacao.autorId,
          tipo: user.tipo === "EXTERNO" ? "MUNICIPIO_RESPONDEU" : "CTP_COMENTOU",
          mensagem: `${user.name ?? "Alguém"} respondeu seu apontamento em "${anotacao.trecho.slice(0, 60)}" (v${documento.versao}).`,
          entidadeTipo: "EtapaProjeto",
          entidadeId: etapa.id,
        },
      });
    }
    await registrarAuditoria({ userId: user.id, acao: "RESPONDER_ANOTACAO", entidadeTipo: "AnotacaoDocumento", entidadeId: anotacaoId });
    revalidatePath(`/projetos/${etapa.projetoId}`);
    return undefined;
  });
}

/** CTP (ou o próprio autor) marca o apontamento como resolvido — ou reabre. */
export async function resolverAnotacao(anotacaoId: string, resolvido: boolean): Promise<Resultado> {
  return executar(async () => {
    const anotacao = await prisma.anotacaoDocumento.findUnique({ where: { id: anotacaoId } });
    if (!anotacao) throw new ErroUsuario("Anotação não encontrada.");
    const { user, etapa } = await carregarDocumento(anotacao.documentoId);
    if (user.tipo !== "INTERNO" && anotacao.autorId !== user.id) {
      throw new AcessoNegadoError("Só o CTP ou o autor do apontamento pode marcá-lo como resolvido.");
    }
    if (resolvido && anotacao.tipo === "SUGESTAO") throw new ErroUsuario("Sugestões de redação são aceitas ou recusadas.");
    await prisma.anotacaoDocumento.update({
      where: { id: anotacaoId },
      // Reabrir uma sugestão devolve ela para "aguardando decisão".
      data: resolvido ? { resolvido: true, resolvidoPorId: user.id, resolvidoEm: new Date() } : { resolvido: false, resolvidoPorId: null, resolvidoEm: null, decisao: null },
    });
    await registrarAuditoria({ userId: user.id, acao: resolvido ? "RESOLVER_COMENTARIO" : "REABRIR_COMENTARIO", entidadeTipo: "AnotacaoDocumento", entidadeId: anotacaoId });
    revalidatePath(`/projetos/${etapa.projetoId}`);
    return undefined;
  });
}

/**
 * CTP decide sobre as sugestões de redação do município. ACEITA pressupõe que o texto já foi
 * aplicado pelo editor no rascunho da próxima versão (é lá que o botão aparece); RECUSADA exige
 * o motivo, que fica como resposta no apontamento para o município ler.
 */
export async function decidirSugestoes(anotacaoIds: string[], decisao: DecisaoSugestao, motivo = ""): Promise<Resultado<{ total: number }>> {
  return executar(async () => {
    const user = await requireSession();
    exigirInterno(user, "Só a equipe do CTP decide sobre sugestões de redação.");
    if (decisao !== "ACEITA" && decisao !== "RECUSADA") throw new ErroUsuario("Decisão inválida.");
    const motivoLimpo = motivo.trim().slice(0, 4000);
    if (decisao === "RECUSADA" && !motivoLimpo) throw new ErroUsuario("Explique ao município por que a sugestão não foi aceita.");
    if (anotacaoIds.length === 0) throw new ErroUsuario("Nenhuma sugestão selecionada.");

    const anotacoes = await prisma.anotacaoDocumento.findMany({
      where: { id: { in: anotacaoIds.slice(0, 200) } },
      include: { documento: { include: { etapa: { include: { projeto: true } } } } },
    });
    if (anotacoes.length !== new Set(anotacaoIds).size) throw new ErroUsuario("Sugestão não encontrada. Recarregue a página.");
    for (const a of anotacoes) {
      if (a.tipo !== "SUGESTAO") throw new ErroUsuario("Este apontamento não é uma sugestão de redação.");
      if (a.decisao) throw new ErroUsuario(`A sugestão sobre "${a.trecho.slice(0, 40)}…" já foi ${a.decisao === "ACEITA" ? "aceita" : "recusada"}.`);
      assertAcessoContratante(user, a.documento.etapa.projeto.contratanteId);
    }
    if (decisao === "ACEITA") {
      const etapaIds = [...new Set(anotacoes.map((a) => a.documento.etapaId))];
      const rascunhos = await prisma.documentoVersionado.count({ where: { etapaId: { in: etapaIds }, enviadoEm: null } });
      if (rascunhos < etapaIds.length) throw new ErroUsuario("Crie a nova versão do documento para aplicar a sugestão.");
    }

    const agora = new Date();
    await prisma.$transaction([
      ...anotacoes.map((a) =>
        prisma.anotacaoDocumento.update({
          where: { id: a.id },
          data: { decisao, resolvido: true, resolvidoPorId: user.id, resolvidoEm: agora },
        }),
      ),
      ...(decisao === "RECUSADA" ? anotacoes.map((a) => prisma.respostaAnotacao.create({ data: { anotacaoId: a.id, autorId: user.id, texto: motivoLimpo } })) : []),
      ...anotacoes.map((a) =>
        prisma.notificacao.create({
          data: {
            userId: a.autorId,
            tipo: "CTP_COMENTOU",
            mensagem: decisao === "ACEITA"
              ? `O CTP aceitou sua sugestão de redação para "${a.trecho.slice(0, 60)}" — ela entra na versão ${a.documento.versao + 1}.`
              : `O CTP não aceitou sua sugestão de redação para "${a.trecho.slice(0, 60)}". Veja o motivo no documento.`,
            entidadeTipo: "EtapaProjeto",
            entidadeId: a.documento.etapaId,
          },
        }),
      ),
    ]);
    for (const a of anotacoes) {
      await registrarAuditoria({ userId: user.id, acao: decisao === "ACEITA" ? "ACEITAR_SUGESTAO" : "RECUSAR_SUGESTAO", entidadeTipo: "AnotacaoDocumento", entidadeId: a.id, detalhe: motivoLimpo || undefined });
    }
    for (const projetoId of new Set(anotacoes.map((a) => a.documento.etapa.projetoId))) revalidatePath(`/projetos/${projetoId}`);
    return { total: anotacoes.length };
  });
}

/** O autor pode apagar a própria anotação enquanto ninguém respondeu. */
export async function excluirAnotacao(anotacaoId: string): Promise<Resultado> {
  return executar(async () => {
    const anotacao = await prisma.anotacaoDocumento.findUnique({ where: { id: anotacaoId }, include: { _count: { select: { respostas: true } } } });
    if (!anotacao) throw new ErroUsuario("Anotação não encontrada.");
    const { user, etapa } = await carregarDocumento(anotacao.documentoId);
    if (anotacao.autorId !== user.id) throw new AcessoNegadoError("Só o autor pode excluir esta anotação.");
    if (anotacao._count.respostas > 0) throw new ErroUsuario("Esta anotação já tem respostas e faz parte do histórico. Marque como resolvida em vez de excluir.");
    await prisma.anotacaoDocumento.delete({ where: { id: anotacaoId } });
    await registrarAuditoria({ userId: user.id, acao: "REMOVER", entidadeTipo: "AnotacaoDocumento", entidadeId: anotacaoId });
    revalidatePath(`/projetos/${etapa.projetoId}`);
    return undefined;
  });
}

/** Leitura obrigatória (mesma regra de antes), em versão que devolve resultado ao editor. */
export async function confirmarLeitura(documentoId: string): Promise<Resultado> {
  return executar(async () => {
    const { user, documento, etapa } = await carregarDocumento(documentoId);
    if (user.tipo !== "EXTERNO") throw new ErroUsuario("A confirmação de leitura é só para o município.");
    if (!documento.enviadoEm) throw new ErroUsuario("Documento não disponível.");
    await prisma.visualizacaoDocumento.upsert({
      where: { documentoId_userId: { documentoId, userId: user.id } },
      update: {},
      create: { documentoId, userId: user.id },
    });
    await registrarAuditoria({ userId: user.id, acao: "CONFIRMAR_VISUALIZACAO", entidadeTipo: "DocumentoVersionado", entidadeId: documentoId });
    revalidatePath(`/projetos/${etapa.projetoId}`);
    return undefined;
  });
}

/** Avaliação da versão inteira pelo município: aprovar, ou pedir ajustes (justificativa obrigatória). */
export async function avaliarVersao(documentoId: string, decisao: "APROVADO" | "REPROVADO", comentario: string): Promise<Resultado> {
  return executar(async () => {
    const { user, documento, etapa } = await carregarDocumento(documentoId);
    if (user.tipo !== "EXTERNO") throw new ErroUsuario("A avaliação da versão é feita pelo município.");
    exigir(user, "minuta.parecer");
    if (decisao !== "APROVADO" && decisao !== "REPROVADO") throw new ErroUsuario("Decisão inválida.");
    const limpo = comentario.trim();
    if (decisao === "REPROVADO" && !limpo) throw new ErroUsuario("Descreva quais ajustes são necessários.");
    const leu = await prisma.visualizacaoDocumento.findUnique({ where: { documentoId_userId: { documentoId, userId: user.id } } });
    if (!leu) throw new ErroUsuario("Confirme a leitura do documento antes de avaliar.");
    const unidade = await prisma.unidadeRevisao.findFirst({ where: { documentoId, tipo: "DOCUMENTO_INTEIRO" } });
    if (!unidade) throw new ErroUsuario("Esta versão não aceita avaliação.");
    if (unidade.status !== "PENDENTE") throw new ErroUsuario("Esta versão já foi avaliada.");

    await prisma.$transaction([
      prisma.unidadeRevisao.update({ where: { id: unidade.id }, data: { status: decisao, comentario: limpo || null, autorId: user.id } }),
      // Avaliou: a vez volta para o CTP.
      prisma.etapaProjeto.update({ where: { id: etapa.id }, data: { status: "EM_ANDAMENTO" } }),
      prisma.notificacao.create({
        data: {
          userId: etapa.responsavelId,
          tipo: "MUNICIPIO_RESPONDEU",
          mensagem: decisao === "APROVADO"
            ? `O município aprovou a versão ${documento.versao} de "${documento.titulo ?? "documento"}" (etapa "${etapa.nome}").`
            : `O município solicitou ajustes na versão ${documento.versao} de "${documento.titulo ?? "documento"}" (etapa "${etapa.nome}").`,
          entidadeTipo: "EtapaProjeto",
          entidadeId: etapa.id,
        },
      }),
    ]);
    await registrarAuditoria({ userId: user.id, acao: `REVISAR_${decisao}`, entidadeTipo: "DocumentoVersionado", entidadeId: documentoId, detalhe: limpo || undefined });
    revalidatePath(`/projetos/${etapa.projetoId}`);
    return undefined;
  });
}
