import type { Extensions } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";

/**
 * Esquema do documento, compartilhado entre o editor (navegador) e o servidor (que valida
 * âncoras de grifo e exporta .docx). Os dois lados precisam usar exatamente a mesma lista —
 * senão as posições (de/ate) calculadas no navegador não batem com as do servidor.
 */
export const extensoesDocumento: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    code: false,
    codeBlock: false,
    link: { openOnClick: false, autolink: true },
  }),
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
  TableKit.configure({ table: { resizable: false } }),
];

/** Cores do marca-texto, em ordem de exibição. O valor é gravado no documento/anotação. */
export const CORES_GRIFO = [
  { chave: "amarelo", nome: "Amarelo", hex: "#fde68a" },
  { chave: "verde", nome: "Verde", hex: "#bbf7d0" },
  { chave: "azul", nome: "Azul", hex: "#bfdbfe" },
  { chave: "rosa", nome: "Rosa", hex: "#fbcfe8" },
] as const;

export type TipoAnotacao = "GRIFO" | "COMENTARIO" | "CONCORDO" | "DISCORDO" | "SUGESTAO";

export const TIPO_ANOTACAO_LABEL: Record<TipoAnotacao, string> = {
  GRIFO: "Grifo",
  COMENTARIO: "Comentário",
  CONCORDO: "Concordo",
  DISCORDO: "Discordo",
  SUGESTAO: "Sugestão de redação",
};

export type DecisaoSugestao = "ACEITA" | "RECUSADA";

/** Normaliza a redação sugerida: sem espaços sobrando nas pontas e no máximo uma linha em branco seguida. */
export function limparSugestao(texto: string): string {
  return texto.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const DOCUMENTO_VAZIO = { type: "doc", content: [{ type: "paragraph" }] };
