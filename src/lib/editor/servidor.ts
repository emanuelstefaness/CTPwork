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

/** Valida e normaliza o JSON vindo do navegador antes de gravar. */
export function normalizarConteudo(json: unknown): string {
  const doc = PMNode.fromJSON(schemaDocumento, json);
  doc.check();
  return JSON.stringify(doc.toJSON());
}
