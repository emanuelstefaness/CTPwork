import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { extensoesDocumento, DOCUMENTO_VAZIO } from "./extensoes";

// O esquema é derivado da mesma lista de extensões do editor do navegador.
export const schemaDocumento = getSchema(extensoesDocumento);

/** Converte o JSON salvo em nó ProseMirror, validando contra o esquema (lança se inválido). */
export function lerDocumento(conteudo: string | null | undefined): PMNode {
  const json = conteudo ? JSON.parse(conteudo) : DOCUMENTO_VAZIO;
  const doc = PMNode.fromJSON(schemaDocumento, json);
  doc.check();
  return doc;
}

const LINK_SEGURO = /^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i;

type NoJson = { marks?: { type?: unknown; attrs?: { href?: unknown } }[]; content?: unknown[] };

/**
 * Tira dos links tudo o que não for endereço web, e-mail, telefone ou âncora (ex.: "javascript:").
 * O editor do navegador já não exibe esses links; aqui é a segunda barreira, antes de gravar.
 */
function limparLinks(no: unknown): void {
  if (!no || typeof no !== "object") return;
  const n = no as NoJson;
  if (Array.isArray(n.marks)) {
    n.marks = n.marks.filter((m) => m?.type !== "link" || (typeof m.attrs?.href === "string" && LINK_SEGURO.test(m.attrs.href.trim())));
  }
  if (Array.isArray(n.content)) n.content.forEach(limparLinks);
}

/** Valida e normaliza o JSON vindo do navegador antes de gravar. */
export function normalizarConteudo(json: unknown): string {
  limparLinks(json);
  const doc = PMNode.fromJSON(schemaDocumento, json);
  doc.check();
  return JSON.stringify(doc.toJSON());
}
