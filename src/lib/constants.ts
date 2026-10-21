// Valores de enum modelados como string no schema (SQLite não suporta enum nativo).
// Centralizar aqui evita strings soltas espalhadas pelo app.

export const TIPO_USUARIO = { INTERNO: "INTERNO", EXTERNO: "EXTERNO" } as const;

export const STATUS_MEMORANDO = {
  ABERTO: "ABERTO",
  EM_EXECUCAO: "EM_EXECUCAO",
  CONCLUIDO: "CONCLUIDO",
  CANCELADO: "CANCELADO",
} as const;

export const STATUS_MEMORANDO_LABEL: Record<string, string> = {
  ABERTO: "Aberto",
  EM_EXECUCAO: "Em execução",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

// Tipos de projeto, etapas de projeto e etapas de contrato não ficam aqui: são dados configuráveis
// em Cadastros (TipoProjetoModelo/EtapaModelo e FluxoContrato/EtapaFluxoContrato).

export const STATUS_ETAPA_LABEL: Record<string, string> = {
  NAO_INICIADA: "Não iniciada",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_MUNICIPIO: "Aguardando município",
  CONCLUIDA: "Concluída",
};
