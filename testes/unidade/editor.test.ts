import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Node as PMNode } from "@tiptap/pm/model";
import { schemaDocumento } from "@/lib/editor/servidor";
import { ajustarAPalavras, ancoraValida, localizarAncora, localizarTrecho, textoDoTrecho } from "@/lib/editor/ancoras";
import { limparSugestao } from "@/lib/editor/extensoes";

const paragrafo = (texto: string) => ({ type: "paragraph", content: [{ type: "text", text: texto }] });
const doc = (...paragrafos: string[]) => PMNode.fromJSON(schemaDocumento, { type: "doc", content: paragrafos.map(paragrafo) });

/** Posição ProseMirror de um trecho no 1º parágrafo (o texto começa na posição 1). */
const noPrimeiro = (texto: string, trecho: string) => {
  const i = texto.indexOf(trecho);
  return { de: 1 + i, ate: 1 + i + trecho.length };
};

describe("âncoras de grifo/comentário", () => {
  const art10 = "mínimo de 24 (vinte e quatro) meses de efetivo exercício.";
  const d = doc(art10, "Art. 11 — promoção após 24 (vinte e quatro) meses na classe.");

  it("textoDoTrecho devolve exatamente o trecho entre as posições", () => {
    const { de, ate } = noPrimeiro(art10, "24 (vinte e quatro) meses");
    assert.equal(textoDoTrecho(d, de, ate), "24 (vinte e quatro) meses");
    assert.ok(ancoraValida(d, de, ate, "24 (vinte e quatro) meses"));
    assert.ok(!ancoraValida(d, de, ate, "outro texto"));
  });

  it("ajustarAPalavras estende a seleção até palavras inteiras e tira espaços das pontas", () => {
    const { de, ate } = noPrimeiro(art10, "inte e quatro) mes");
    const ajustado = ajustarAPalavras(d, de, ate);
    assert.equal(textoDoTrecho(d, ajustado.de, ajustado.ate), "vinte e quatro) meses");

    const comEspacos = noPrimeiro(art10, " efetivo ");
    const limpo = ajustarAPalavras(d, comEspacos.de, comEspacos.ate);
    assert.equal(textoDoTrecho(d, limpo.de, limpo.ate), "efetivo");
  });

  it("localizarAncora usa a posição original quando o texto não mudou", () => {
    const original = noPrimeiro(art10, "24 (vinte e quatro) meses");
    assert.deepEqual(localizarAncora(d, "24 (vinte e quatro) meses", original.de, original.ate), original);
  });

  it("localizarAncora pega a ocorrência mais próxima quando o texto foi deslocado", () => {
    // O mesmo trecho aparece nos dois artigos; o apontamento era do 2º.
    const segunda = localizarTrecho(d, "24 (vinte e quatro) meses", 1)!;
    const editado = doc("Texto novo inserido antes. " + art10, "Art. 11 — promoção após 24 (vinte e quatro) meses na classe.");
    const achado = localizarAncora(editado, "24 (vinte e quatro) meses", segunda.de, segunda.ate)!;
    assert.equal(textoDoTrecho(editado, achado.de, achado.ate), "24 (vinte e quatro) meses");
    assert.ok(achado.de > editado.child(0).nodeSize, "deveria estar no 2º parágrafo, não no 1º");
  });

  it("localizarAncora devolve nulo quando o trecho não existe mais", () => {
    assert.equal(localizarAncora(doc("texto totalmente reescrito"), "24 (vinte e quatro) meses", 5, 30), null);
  });
});

describe("sugestão de redação", () => {
  it("limparSugestao tira espaços das pontas e junta linhas em branco repetidas", () => {
    assert.equal(limparSugestao("  36 (trinta e seis) meses  "), "36 (trinta e seis) meses");
    assert.equal(limparSugestao("Art. 1º\r\n\r\n\r\n\r\nParágrafo único.   \nTexto"), "Art. 1º\n\nParágrafo único.\nTexto");
    assert.equal(limparSugestao("   "), "");
  });
});
