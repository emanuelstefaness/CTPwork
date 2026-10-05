import { documentosDoTexto } from "@/lib/documentos-padrao";

/** Regras puras dos documentos do contrato — usadas também em componentes de cliente (sem Prisma). */

/** Quem envia um documento pedido no contrato. */
export type EnviaQuem = "PREFEITURA" | "CTP";
export type DocumentoPadraoContrato = { nome: string; enviaQuem: EnviaQuem };

/** EtapaFluxoContrato.documentosPadrao (JSON) → lista validada. */
export function lerDocumentosPadraoContrato(json: string | null | undefined): DocumentoPadraoContrato[] {
  try {
    const lista = JSON.parse(json ?? "[]");
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((d) => d && typeof d.nome === "string" && d.nome.trim())
      .map((d) => ({ nome: String(d.nome).trim(), enviaQuem: d.enviaQuem === "CTP" ? "CTP" : "PREFEITURA" }));
  } catch {
    return [];
  }
}

/** Duas listas do formulário de Cadastros (uma por linha) → JSON gravado na etapa do tipo de contrato. */
export function documentosPadraoDoFormulario(formData: FormData): string {
  const daPrefeitura = documentosDoTexto(String(formData.get("docsPrefeitura") ?? "")).map((nome) => ({ nome, enviaQuem: "PREFEITURA" as const }));
  const doCtp = documentosDoTexto(String(formData.get("docsCtp") ?? "")).map((nome) => ({ nome, enviaQuem: "CTP" as const }));
  return JSON.stringify([...daPrefeitura, ...doCtp]);
}

/** Documentos da etapa que ainda impedem o avanço (não aprovados). */
export function documentosEmAberto<T extends { status: string }>(documentos: T[]) {
  return documentos.filter((d) => d.status !== "APROVADO");
}
