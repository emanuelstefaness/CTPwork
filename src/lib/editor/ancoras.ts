import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Texto de um trecho do documento, do jeito que é citado na anotação. Navegador e servidor
 * usam esta mesma função, então o servidor consegue conferir que o trecho enviado bate com
 * as posições (de/ate) naquela versão do documento.
 */
export function textoDoTrecho(doc: PMNode, de: number, ate: number): string {
  return doc.textBetween(de, ate, "\n", "\n").replace(/\s+/g, " ").trim();
}

/**
 * Estende a seleção até palavras inteiras e tira espaços das pontas — como o Word faz ao
 * selecionar com o mouse. Evita grifos terminando no meio de uma palavra ("depe|nderá").
 */
export function ajustarAPalavras(doc: PMNode, de: number, ate: number): { de: number; ate: number } {
  const letra = /[\p{L}\p{N}ºª°]/u;
  const max = doc.content.size;
  const antes = (p: number) => (p <= 0 ? "" : doc.textBetween(p - 1, p, "\n", "\n"));
  const depois = (p: number) => (p >= max ? "" : doc.textBetween(p, p + 1, "\n", "\n"));
  while (de > 0 && letra.test(antes(de)) && letra.test(depois(de))) de--;
  while (ate < max && letra.test(antes(ate)) && letra.test(depois(ate))) ate++;
  while (de < ate && /\s/.test(depois(de))) de++;
  while (ate > de && /\s/.test(antes(ate))) ate--;
  return { de, ate };
}

export function ancoraValida(doc: PMNode, de: number, ate: number, trecho: string): boolean {
  if (!Number.isInteger(de) || !Number.isInteger(ate) || de < 0 || ate <= de || ate > doc.content.size) return false;
  return textoDoTrecho(doc, de, ate) === trecho.replace(/\s+/g, " ").trim();
}

/**
 * Reencontra no rascunho o trecho de um apontamento feito na versão anterior. O rascunho nasce
 * como cópia dessa versão, então primeiro confere a posição original (vale também para trechos
 * que atravessam parágrafos); se o CTP já mexeu no texto antes dele, pega a ocorrência do trecho
 * mais próxima da posição original — não simplesmente a primeira, que pode ser outro artigo.
 */
export function localizarAncora(doc: PMNode, trecho: string, de: number, ate: number): { de: number; ate: number } | null {
  if (ancoraValida(doc, de, ate, trecho)) return { de, ate };
  let melhor: { de: number; ate: number } | null = null;
  for (let i = 0, pos = localizarTrecho(doc, trecho, 0); pos && i < 500; i++, pos = localizarTrecho(doc, trecho, i)) {
    if (!melhor || Math.abs(pos.de - de) < Math.abs(melhor.de - de)) melhor = pos;
  }
  return melhor;
}

/**
 * Procura `trecho` dentro de um único parágrafo/título e devolve a posição ProseMirror.
 * Usado para ancorar grifos criados fora do editor (dados importados) e para reencontrar
 * um apontamento de uma versão anterior no rascunho atual. `ocorrencia` escolhe entre
 * repetições do mesmo texto (0 = primeira).
 */
export function localizarTrecho(doc: PMNode, trecho: string, ocorrencia = 0, aPartirDe = 0): { de: number; ate: number } | null {
  const alvo = trecho.trim();
  if (!alvo) return null;
  let encontrados = 0;
  let resultado: { de: number; ate: number } | null = null;

  doc.descendants((node, pos) => {
    if (resultado) return false;
    if (!node.isTextblock) return true;
    if (pos + node.nodeSize < aPartirDe) return false;

    // Monta o texto do bloco com o mapa caractere → posição no documento.
    let texto = "";
    const mapa: number[] = [];
    node.forEach((filho, offset) => {
      const inicio = pos + 1 + offset;
      if (filho.isText && filho.text) {
        for (let i = 0; i < filho.text.length; i++) {
          texto += filho.text[i];
          mapa.push(inicio + i);
        }
      } else {
        texto += "\n";
        mapa.push(inicio);
      }
    });

    let idx = texto.indexOf(alvo);
    while (idx !== -1) {
      const de = mapa[idx];
      if (de >= aPartirDe) {
        if (encontrados === ocorrencia) {
          resultado = { de, ate: mapa[idx + alvo.length - 1] + 1 };
          return false;
        }
        encontrados++;
      }
      idx = texto.indexOf(alvo, idx + 1);
    }
    return false;
  });

  return resultado;
}
