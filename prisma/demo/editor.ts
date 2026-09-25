import type { PrismaClient } from "@prisma/client";
import { Node as PMNode } from "@tiptap/pm/model";
import { schemaDocumento } from "../../src/lib/editor/servidor";
import { localizarTrecho, textoDoTrecho } from "../../src/lib/editor/ancoras";

/**
 * Converte as versões antigas (seções / artigos em tabelas separadas) para o formato do editor:
 * o texto vira o JSON do documento, os grifos de seção viram anotações ancoradas no trecho, e a
 * aprovação/reprovação por artigo vira "Concordo"/"Discordo" sobre o título do artigo. Não apaga
 * nada do formato antigo e é idempotente (ids fixos derivados dos registros de origem).
 */

type NoJSON = { type: string; attrs?: Record<string, unknown>; content?: NoJSON[]; text?: string };

const paragrafo = (texto: string): NoJSON => ({ type: "paragraph", attrs: { textAlign: "justify" }, content: texto ? [{ type: "text", text: texto }] : [] });
const titulo = (texto: string, nivel = 2): NoJSON => ({ type: "heading", attrs: { level: nivel }, content: [{ type: "text", text: texto }] });

function paragrafosDe(texto: string): NoJSON[] {
  return texto.split(/\n+/).map((l) => l.trim()).filter(Boolean).map(paragrafo);
}

/** Posição e tamanho de cada título no documento — início de cada seção/artigo. */
function titulosDoDocumento(doc: PMNode): { pos: number; tamanho: number }[] {
  const lista: { pos: number; tamanho: number }[] = [];
  doc.forEach((no, offset) => {
    if (no.type.name === "heading") lista.push({ pos: offset, tamanho: no.content.size });
  });
  return lista;
}

function nomeDoObjeto(objeto: string) {
  return objeto.replace(/^(Elaboração|Revisão|Atualização)\s+(do|da|de|dos|das)\s+/i, "").replace(/^./, (c) => c.toUpperCase());
}

export async function migrarDocumentosParaEditor(prisma: PrismaClient) {
  const docs = await prisma.documentoVersionado.findMany({
    where: { conteudo: null },
    include: {
      etapa: { include: { projeto: { include: { contratoOrigem: true } } } },
      secoes: { include: { comentarios: true }, orderBy: { ordem: "asc" } },
      unidadesRevisao: { orderBy: { createdAt: "asc" } },
    },
  });

  let convertidos = 0;
  let anotacoes = 0;

  for (const d of docs) {
    const artigos = d.unidadesRevisao.filter((u) => u.tipo === "ARTIGO");
    const porSecao = d.secoes.length > 0;
    const porArtigo = !porSecao && artigos.length > 0 && artigos.every((u) => u.conteudo);
    if (!porSecao && !porArtigo) continue; // versão só com arquivo: fica como anexo legado

    const objeto = nomeDoObjeto(d.etapa.projeto.contratoOrigem.objeto);
    const tituloDoc = porArtigo ? `Minuta — ${objeto}` : `${d.etapa.nome} — ${objeto}`;

    const blocos: NoJSON[] = porSecao
      ? d.secoes.flatMap((s, i) => [titulo(`${i + 1}. ${s.titulo}`), ...paragrafosDe(s.conteudo)])
      : artigos.flatMap((u) => [titulo(u.identificador), ...paragrafosDe(u.conteudo ?? "")]);
    const json = { type: "doc", content: blocos };
    const doc = PMNode.fromJSON(schemaDocumento, json);
    doc.check();
    const titulos = titulosDoDocumento(doc);

    await prisma.documentoVersionado.update({
      where: { id: d.id },
      data: { conteudo: JSON.stringify(doc.toJSON()), titulo: tituloDoc, enviadoEm: d.enviadoEm ?? d.createdAt },
    });
    convertidos++;

    if (porSecao) {
      for (const [i, s] of d.secoes.entries()) {
        const inicioSecao = titulos[i]?.pos ?? 0;
        for (const c of s.comentarios) {
          const pos = localizarTrecho(doc, c.trechoTexto, 0, inicioSecao);
          if (!pos) continue;
          const id = `anot-${c.id}`;
          const dados = {
            documentoId: d.id,
            autorId: c.autorId,
            de: pos.de,
            ate: pos.ate,
            trecho: textoDoTrecho(doc, pos.de, pos.ate),
            tipo: "COMENTARIO",
            texto: c.comentario,
            resolvido: c.resolvido,
            resolvidoPorId: c.resolvido ? d.etapa.responsavelId : null,
            resolvidoEm: c.resolvido ? c.createdAt : null,
            createdAt: c.createdAt,
          };
          await prisma.anotacaoDocumento.upsert({ where: { id }, update: dados, create: { id, ...dados } });
          anotacoes++;
        }
      }
    } else {
      for (const [i, u] of artigos.entries()) {
        if (u.status === "PENDENTE") continue;
        const cabecalho = titulos[i];
        if (!cabecalho) continue;
        // Concordo/Discordo ancorado no título do artigo ("Art. 9º — Dos requisitos…").
        const de = cabecalho.pos + 1;
        const ate = de + cabecalho.tamanho;
        const id = `anot-u-${u.id}`;
        const dados = {
          documentoId: d.id,
          autorId: u.autorId,
          de,
          ate,
          trecho: textoDoTrecho(doc, de, ate),
          tipo: u.status === "APROVADO" ? "CONCORDO" : "DISCORDO",
          texto: u.comentario ?? (u.status === "REPROVADO" ? "Artigo reprovado na revisão." : null),
          createdAt: u.createdAt,
        };
        await prisma.anotacaoDocumento.upsert({ where: { id }, update: dados, create: { id, ...dados } });
        anotacoes++;
      }

      // Parecer da versão inteira, derivado dos pareceres por artigo.
      if (!d.unidadesRevisao.some((u) => u.tipo === "DOCUMENTO_INTEIRO")) {
        const pendentes = artigos.filter((u) => u.status === "PENDENTE");
        const reprovados = artigos.filter((u) => u.status === "REPROVADO");
        const decisor = artigos.find((u) => u.status !== "PENDENTE");
        await prisma.unidadeRevisao.create({
          data: {
            id: `aval-${d.id}`,
            documentoId: d.id,
            tipo: "DOCUMENTO_INTEIRO",
            identificador: "documento_inteiro",
            status: pendentes.length ? "PENDENTE" : reprovados.length ? "REPROVADO" : "APROVADO",
            comentario: !pendentes.length && reprovados.length ? `Ajustes solicitados em: ${reprovados.map((r) => r.identificador.split(" — ")[0]).join(", ")}.` : null,
            autorId: decisor && !pendentes.length ? decisor.autorId : d.criadoPorId,
            createdAt: d.createdAt,
          },
        });
      }
    }
  }

  return { convertidos, anotacoes };
}

/** Respostas do CTP em apontamentos já resolvidos — mostra a conversa encadeada na demonstração. */
export async function semearRespostasDemo(prisma: PrismaClient) {
  const resolvidas = await prisma.anotacaoDocumento.findMany({
    where: { resolvido: true, id: { startsWith: "anot-" }, autor: { tipo: "EXTERNO" } },
    include: { documento: { include: { etapa: true } } },
  });
  const textos = [
    "Obrigado pelo apontamento. Incorporamos o ajuste na versão seguinte.",
    "Ajustado conforme solicitado — confira o novo texto na próxima versão.",
    "Dados complementados com a fonte indicada. Marcamos como resolvido.",
  ];
  for (const [i, a] of resolvidas.entries()) {
    const id = `resp-${a.id}`;
    const dados = {
      anotacaoId: a.id,
      autorId: a.documento.etapa.responsavelId,
      texto: textos[i % textos.length],
      createdAt: new Date(a.createdAt.getTime() + 1000 * 60 * 60 * 20),
    };
    await prisma.respostaAnotacao.upsert({ where: { id }, update: dados, create: { id, ...dados } });
  }
  return resolvidas.length;
}
