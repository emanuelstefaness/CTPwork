import type { PrismaClient } from "@prisma/client";

/**
 * Configuração base do sistema — o que ele precisa para funcionar sem nenhum dado de exemplo:
 * tipos de projeto com suas etapas, setores e modelos de formulário. Perfis de fábrica e o tipo de
 * contrato Padrão vêm das migrações. Usado pelo banco limpo (seed-base.ts) e pelo seed de demonstração.
 * Idempotente: update espelha create, para reaplicar a base corrige nome/ordem/funções das etapas.
 */

type EtapaBase = {
  nome: string; temInformacoesProjeto?: boolean; temFormulario?: boolean; temChecklist?: boolean;
  temRevisao?: boolean; modoRevisao?: string; documentosPadrao?: string[];
};

async function semearTipoProjeto(prisma: PrismaClient, chave: string, nome: string, etapas: EtapaBase[]) {
  const tipo = await prisma.tipoProjetoModelo.upsert({ where: { chave }, update: { nome }, create: { chave, nome } });
  for (const [i, etapa] of etapas.entries()) {
    const dados = {
      nome: etapa.nome, ordem: i,
      temInformacoesProjeto: etapa.temInformacoesProjeto ?? false,
      temFormulario: etapa.temFormulario ?? false,
      temChecklist: etapa.temChecklist ?? false,
      temRevisao: etapa.temRevisao ?? false,
      modoRevisao: etapa.modoRevisao ?? "ARTIGO",
      documentosPadrao: JSON.stringify(etapa.documentosPadrao ?? []),
    };
    const id = `etapa-modelo-${chave.toLowerCase()}-${i}`;
    await prisma.etapaModelo.upsert({ where: { id }, update: dados, create: { id, tipoProjetoModeloId: tipo.id, ...dados } });
  }
  return tipo;
}

export const SETORES_BASE = ["Administrativo", "Comunicação", "Jurídico", "Técnico"];

export async function semearConfiguracaoBase(prisma: PrismaClient) {
  await semearTipoProjeto(prisma, "ESTATUTO_PCCS", "Estatuto e PCCS", [
    { nome: "Informações iniciais", temInformacoesProjeto: true },
    { nome: "Documentos iniciais", temFormulario: true, temChecklist: true },
    { nome: "Diagnóstico inicial", temRevisao: true, modoRevisao: "DOCUMENTO_INTEIRO" },
    { nome: "Minutas versão 01", temRevisao: true, modoRevisao: "ARTIGO" },
    { nome: "Análise e devolutiva 01", temRevisao: true, modoRevisao: "DOCUMENTO_INTEIRO" },
    { nome: "Minutas 02", temRevisao: true, modoRevisao: "ARTIGO" },
    { nome: "Devolutiva 02", temRevisao: true, modoRevisao: "DOCUMENTO_INTEIRO" },
  ]);
  await semearTipoProjeto(prisma, "PLANO_DIRETOR", "Plano Diretor", [
    { nome: "Informações iniciais", temInformacoesProjeto: true },
    { nome: "Documentos iniciais", temFormulario: true, temChecklist: true },
    { nome: "Fase 01 — Leitura técnica e comunitária", temRevisao: true, modoRevisao: "DOCUMENTO_INTEIRO" },
    { nome: "Fase 02 — Diretrizes e propostas", temRevisao: true, modoRevisao: "DOCUMENTO_INTEIRO" },
    { nome: "Fase 03 — Minuta do projeto de lei", temRevisao: true, modoRevisao: "ARTIGO" },
    { nome: "Fase 04 — Audiência pública", temChecklist: true, documentosPadrao: ["Edital de convocação da audiência pública", "Ata da audiência pública", "Lista de presença"] },
    { nome: "Fase 05 — Versão final e envio à Câmara", temRevisao: true, modoRevisao: "DOCUMENTO_INTEIRO" },
  ]);
  await semearTipoProjeto(prisma, "PERSONALIZADO", "Personalizado", [
    { nome: "Informações iniciais", temInformacoesProjeto: true },
    { nome: "Documentos iniciais", temFormulario: true, temChecklist: true },
    { nome: "Fase 01", temRevisao: true, modoRevisao: "DOCUMENTO_INTEIRO" },
  ]);

  for (const nome of SETORES_BASE) await prisma.setor.upsert({ where: { nome }, update: {}, create: { nome } });

  // Formulário da etapa "Documentos iniciais" dos projetos (tipo CONTRATO) e modelos de memorando.
  const modelos = [
    {
      id: "modelo-documentos-iniciais", nome: "Documentos iniciais do município", tipo: "CONTRATO",
      campos: [
        { chave: "lei_organica_url", label: "Lei Orgânica vigente (link/anexo)", tipo: "text", obrigatorio: true },
        { chave: "organograma", label: "Organograma atual", tipo: "textarea", obrigatorio: true },
        { chave: "quadro_pessoal", label: "Quadro de pessoal atual", tipo: "textarea", obrigatorio: true },
        { chave: "responsavel_contato", label: "Responsável de contato no município", tipo: "text", obrigatorio: true },
      ],
    },
    {
      id: "modelo-solicitacao-carro", nome: "Solicitação de carro", tipo: "MEMORANDO",
      campos: [
        { chave: "data", label: "Data de uso", tipo: "date", obrigatorio: true },
        { chave: "horario", label: "Horário", tipo: "text", obrigatorio: true },
        { chave: "destino", label: "Destino", tipo: "text", obrigatorio: true },
        { chave: "motivo", label: "Motivo", tipo: "textarea", obrigatorio: false },
      ],
    },
  ];
  for (const m of modelos) {
    const dados = { nome: m.nome, tipo: m.tipo, campos: JSON.stringify(m.campos) };
    await prisma.modeloFormulario.upsert({ where: { id: m.id }, update: {}, create: { id: m.id, ...dados } });
  }
}
