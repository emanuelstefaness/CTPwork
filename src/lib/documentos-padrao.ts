/**
 * Documentos que uma etapa do modelo de projeto pede por padrão (EtapaModelo.documentosPadrao,
 * JSON string[]). Viram itens do checklist quando o projeto é criado ou quando o modelo é
 * aplicado às etapas ainda não iniciadas.
 */
export function lerDocumentosPadrao(json: string | null | undefined): string[] {
  try {
    const lista = JSON.parse(json ?? "[]");
    return Array.isArray(lista) ? lista.filter((d): d is string => typeof d === "string" && d.trim() !== "") : [];
  } catch {
    return [];
  }
}

/** Texto do formulário (um documento por linha) → lista limpa, sem repetidos. */
export function documentosDoTexto(texto: string): string[] {
  const vistos = new Set<string>();
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.trim().slice(0, 200))
    .filter((linha) => linha && !vistos.has(linha.toLowerCase()) && vistos.add(linha.toLowerCase()));
}
