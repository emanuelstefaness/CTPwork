/**
 * Campos "somente data" (dataVigencia, prazo, evento de cronograma) são salvos como
 * meia-noite UTC. Formatar no fuso local sem travar o timeZone faria o dia "voltar"
 * em fusos negativos (ex.: 14/03 vira 13/03 em UTC-3) — por isso sempre UTC aqui.
 */
export function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/**
 * Só o dia de um evento real (createdAt, enviadoEm), no fuso de Brasília. Não usar formatarData
 * nesses casos: algo feito às 22h de 24/09 aqui já é 25/09 em UTC.
 */
export function formatarDiaDoEvento(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Data + hora de eventos reais (createdAt, assinadoEm) — esses sim no fuso de Brasília. */
export function formatarDataHora(data: Date): string {
  return data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias" — cai para a data completa após uma semana. */
export function formatarRelativo(data: Date, agora = new Date()): string {
  const min = Math.round((agora.getTime() - data.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Nomes de modelo do banco que aparecem em auditoria/notificação, em linguagem de usuário. */
export const ENTIDADE_LABEL: Record<string, string> = {
  Memorando: "Memorando",
  Contrato: "Contrato",
  Projeto: "Projeto",
  EtapaProjeto: "Etapa de projeto",
  DocumentoVersionado: "Documento",
  UnidadeRevisao: "Revisão de artigo",
  ComentarioDocumento: "Comentário",
  SecaoDocumento: "Seção do documento",
  AnotacaoDocumento: "Grifo / comentário",
  Conversa: "Conversa com município",
  ChecklistItem: "Checklist de documentos",
  Setor: "Setor",
  User: "Usuário",
  Municipio: "Município",
  ModeloFormulario: "Modelo de formulário",
  TipoProjetoModelo: "Fluxo de projeto",
  EtapaModelo: "Etapa do fluxo",
};

export function iniciais(nome: string): string {
  return nome.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}
