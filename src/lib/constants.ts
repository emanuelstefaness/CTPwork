// Valores de enum modelados como string no schema (SQLite não suporta enum nativo).
// Centralizar aqui evita strings soltas espalhadas pelo app.

export const TIPO_USUARIO = { INTERNO: "INTERNO", EXTERNO: "EXTERNO" } as const;
export type TipoUsuario = (typeof TIPO_USUARIO)[keyof typeof TIPO_USUARIO];

export const PERFIL_INTERNO = { COLABORADOR: "COLABORADOR", GESTOR: "GESTOR" } as const;
export type PerfilInterno = (typeof PERFIL_INTERNO)[keyof typeof PERFIL_INTERNO];

export const STATUS_MEMORANDO = {
  ABERTO: "ABERTO",
  EM_EXECUCAO: "EM_EXECUCAO",
  CONCLUIDO: "CONCLUIDO",
  CANCELADO: "CANCELADO",
} as const;
export type StatusMemorando = (typeof STATUS_MEMORANDO)[keyof typeof STATUS_MEMORANDO];

export const STATUS_MEMORANDO_LABEL: Record<string, string> = {
  ABERTO: "Aberto",
  EM_EXECUCAO: "Em execução",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

// Tipo de projeto e o fluxo de etapas de cada um deixaram de ser fixos aqui — agora são dados
// (TipoProjetoModelo + EtapaModelo, geridos em /cadastros?aba=fluxos), para o Gestor CTP poder
// criar novos tipos de projeto (ex.: "Plano de Mobilidade") sem depender de alteração de código.

export const MODO_REVISAO = { ARTIGO: "ARTIGO", DOCUMENTO_INTEIRO: "DOCUMENTO_INTEIRO" } as const;
export type ModoRevisao = (typeof MODO_REVISAO)[keyof typeof MODO_REVISAO];

export const STATUS_ETAPA = {
  NAO_INICIADA: "NAO_INICIADA",
  EM_ANDAMENTO: "EM_ANDAMENTO",
  AGUARDANDO_MUNICIPIO: "AGUARDANDO_MUNICIPIO",
  CONCLUIDA: "CONCLUIDA",
} as const;
export type StatusEtapa = (typeof STATUS_ETAPA)[keyof typeof STATUS_ETAPA];

export const STATUS_ETAPA_LABEL: Record<string, string> = {
  NAO_INICIADA: "Não iniciada",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_MUNICIPIO: "Aguardando município",
  CONCLUIDA: "Concluída",
};

export const STATUS_CHECKLIST_ITEM = {
  PENDENTE: "PENDENTE",
  ENVIADO: "ENVIADO",
  APROVADO: "APROVADO",
} as const;

export const STATUS_REVISAO_UNIDADE = {
  PENDENTE: "PENDENTE",
  APROVADO: "APROVADO",
  REPROVADO: "REPROVADO",
} as const;

export const STATUS_SIGNATARIO = { PENDENTE: "PENDENTE", ASSINADO: "ASSINADO" } as const;

// Etapas do fluxo de contrato "Padrão". As etapas de contrato agora são configuráveis
// (FluxoContrato, em Cadastros › Fluxos de contrato; ver src/lib/fluxo-contrato.ts) — esta lista só
// é usada pelos seeds, e é a mesma que a migração 20260925145309_fluxos_de_contrato gravou no banco.
export const ETAPAS_CONTRATO = [
  { chave: "PEDIDO_ORCAMENTO", nome: "Pedido de orçamento", curto: "Pedido" },
  { chave: "EMISSAO_ORCAMENTO", nome: "Emissão de orçamento", curto: "Orçamento" },
  { chave: "APROVACAO_ORCAMENTO", nome: "Aprovação do orçamento", curto: "Aprovação" },
  { chave: "DOCUMENTOS_CONTRATACAO", nome: "Documentos para contratação", curto: "Documentos" },
  { chave: "TERMO_REFERENCIA_MINUTA", nome: "Contrato e termo de referência — minuta", curto: "Minuta" },
  { chave: "TERMO_REFERENCIA_ASSINADO", nome: "Contrato e termo de referência — assinado", curto: "Assinado" },
] as const;

export const ETAPA_CONTRATO_FINAL = "TERMO_REFERENCIA_ASSINADO";
