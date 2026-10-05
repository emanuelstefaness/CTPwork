import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { gravarPdf, type Bloco } from "./demo/pdf";
import {
  ARTIGOS_PCCS_V1, ARTIGOS_PCCS_V2, ARTIGOS_PCCS_V3, SECOES_MOBILIDADE_V1, SECOES_PD_GUARAPUAVA_V2, SECOES_PD_PATOBRANCO_V1,
  type ArtigoSpec, type Autor, type SecaoSpec,
} from "./demo/documentos";
import { CONVERSAS } from "./demo/conversas";
import { blocosDeDoc, docChecklist, docContrato, type ChaveChecklist } from "./demo/conteudo";
import { migrarDocumentosParaEditor, semearRespostasDemo } from "./demo/editor";

// Seed de DEMONSTRAÇÃO: popula o sistema com contratos, projetos, documentos, grifos/comentários das
// duas partes, conversas, memorandos e notificações. É idempotente (ids fixos + upsert) e NÃO apaga
// nada: pode ser rodado várias vezes sobre o banco atual. Pré-requisito: `npm run seed` já executado.
//   npm run seed:demo

const prisma = new PrismaClient();
const d = (iso: string) => new Date(iso);
const RODAPE = "CTP Work — Cilla Tech Park";

type Usuario = Autor | "diego";
type Status = "NAO_INICIADA" | "EM_ANDAMENTO" | "AGUARDANDO_MUNICIPIO" | "CONCLUIDA";

const U = {} as Record<Usuario, string>;

// ───────────────────────────── infraestrutura de arquivos ─────────────────────────────

async function anexo(id: string, nomeOriginal: string, blocos: Bloco[], quando: string, vinculo: { contratoId?: string; memorandoId?: string } = {}) {
  const tamanho = await gravarPdf(id, `${RODAPE}  ·  ${nomeOriginal}`, blocos);
  const dados = { nomeOriginal, caminho: `/api/files/${id}`, tamanho, tipoMime: "application/pdf", createdAt: d(quando), contratoId: vinculo.contratoId ?? null, memorandoId: vinculo.memorandoId ?? null };
  await prisma.anexo.upsert({ where: { id }, update: dados, create: { id, ...dados } });
  return id;
}

// ───────────────────────────── usuários e municípios ─────────────────────────────

const MUNICIPIOS = [
  { id: "municipio-mariopolis", nome: "Prefeitura de Mariópolis", contatoNome: "Secretaria Municipal de Administração", contatoEmail: "administracao@mariopolis.pr.gov.br", contatoFone: "(46) 3232-1200" },
  { id: "municipio-pato-branco", nome: "Prefeitura de Pato Branco", contatoNome: "Diretoria de Planejamento Urbano", contatoEmail: "planejamento@patobranco.pr.gov.br", contatoFone: "(46) 3220-1500" },
  { id: "municipio-coronel-vivida", nome: "Prefeitura de Coronel Vivida", contatoNome: "Secretaria Municipal de Obras", contatoEmail: "obras@coronelvivida.pr.gov.br", contatoFone: "(46) 3232-8000" },
  { id: "municipio-palmas", nome: "Prefeitura de Palmas", contatoNome: "Gabinete do Prefeito", contatoEmail: "gabinete@palmas.pr.gov.br", contatoFone: "(46) 3262-1100" },
];
const NOME_MUNICIPIO: Record<string, string> = { "municipio-demo": "Prefeitura de Guarapuava" };
for (const m of MUNICIPIOS) NOME_MUNICIPIO[m.id] = m.nome;

const EXTERNOS: { chave: Usuario; nome: string; email: string; municipioId: string }[] = [
  { chave: "marina", nome: "Marina Kowalski", email: "marina.kowalski@guarapuava.pr.gov.br", municipioId: "municipio-demo" },
  { chave: "helena", nome: "Helena Bittencourt", email: "helena.bittencourt@mariopolis.pr.gov.br", municipioId: "municipio-mariopolis" },
  { chave: "rogerio", nome: "Rogério Dalla Costa", email: "rogerio.dallacosta@mariopolis.pr.gov.br", municipioId: "municipio-mariopolis" },
  { chave: "juliana", nome: "Juliana Menegatti", email: "juliana.menegatti@patobranco.pr.gov.br", municipioId: "municipio-pato-branco" },
  { chave: "ricardo", nome: "Ricardo Sartori", email: "ricardo.sartori@patobranco.pr.gov.br", municipioId: "municipio-pato-branco" },
  { chave: "tatiane", nome: "Tatiane Wolff", email: "tatiane.wolff@coronelvivida.pr.gov.br", municipioId: "municipio-coronel-vivida" },
  { chave: "eduardo", nome: "Eduardo Gasparin", email: "eduardo.gasparin@palmas.pr.gov.br", municipioId: "municipio-palmas" },
];

async function semearPessoas() {
  for (const [chave, email] of Object.entries({ ana: "gestor@ctp.org.br", bruno: "colaborador@ctp.org.br", carla: "juridico@ctp.org.br", diego: "admin@ctp.org.br", cilla: "municipio@cilla.mg.gov.br" })) {
    U[chave as Usuario] = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  }
  for (const m of MUNICIPIOS) {
    const { id, ...dados } = m;
    await prisma.municipio.upsert({ where: { id }, update: dados, create: { id, ...dados } });
  }
  const senha = await bcrypt.hash("ctpwork123", 10);
  for (const e of EXTERNOS) {
    const id = `user-demo-${e.chave}`;
    const dados = { nome: e.nome, email: e.email, tipo: "EXTERNO", municipioId: e.municipioId };
    await prisma.user.upsert({ where: { id }, update: dados, create: { id, passwordHash: senha, ...dados } });
    U[e.chave] = id;
  }
}

// ───────────────────────────── contratos ─────────────────────────────

const ETAPAS_CONTRATO = ["PEDIDO_ORCAMENTO", "EMISSAO_ORCAMENTO", "APROVACAO_ORCAMENTO", "DOCUMENTOS_CONTRATACAO", "TERMO_REFERENCIA_MINUTA", "TERMO_REFERENCIA_ASSINADO"] as const;

type SignatarioSpec = { userKey?: Usuario; nomeExterno?: string; status: "ASSINADO" | "PENDENTE"; quando?: string; ip?: string };
type ContratoSpec = {
  id: string; codigo: string; objeto: string; municipioId: string; etapa: (typeof ETAPAS_CONTRATO)[number]; responsavel: Usuario;
  criado: string; tags: string[]; valor: string;
  assinatura?: SignatarioSpec[];
  /** contratos que já têm fluxo criado por testes anteriores: só ajusta as datas de assinatura */
  manterFluxo?: { assinadoEm?: string };
};

const dia = (base: string, dias: number) => new Date(d(base).getTime() + dias * 86400000).toISOString();
const assinaturaCompleta = (municipio: string, quando: string): SignatarioSpec[] => [
  { userKey: "ana", status: "ASSINADO", quando: dia(quando, 0), ip: "189.44.12.31" },
  { userKey: "carla", status: "ASSINADO", quando: dia(quando, 0.1), ip: "189.44.12.47" },
  { nomeExterno: `Prefeito Municipal de ${municipio}`, status: "ASSINADO", quando: dia(quando, 1.3), ip: "200.17.203.88" },
];

const CONTRATOS: ContratoSpec[] = [
  { id: "contrato-demo-guarapuava", codigo: "CTR-2026-017", objeto: "Elaboração do Estatuto e Plano de Cargos, Carreira e Salários", municipioId: "municipio-demo", etapa: "TERMO_REFERENCIA_ASSINADO", responsavel: "ana", criado: "2026-05-12T09:00:00-03:00", tags: ["prioritário", "estatuto"], valor: "R$ 486.000,00", assinatura: assinaturaCompleta("Guarapuava", "2026-06-04T10:30:00-03:00") },
  { id: "contrato-demo-plano-diretor", codigo: "CTR-2026-018", objeto: "Elaboração do Plano Diretor Municipal", municipioId: "municipio-demo", etapa: "TERMO_REFERENCIA_ASSINADO", responsavel: "bruno", criado: "2026-06-02T09:00:00-03:00", tags: ["plano-diretor"], valor: "R$ 892.500,00", assinatura: assinaturaCompleta("Guarapuava", "2026-06-25T14:00:00-03:00") },
  { id: "cmu3j57y4000157e3yo6dj7i1", codigo: "CTR-2026-024", objeto: "Elaboração do Plano Municipal de Saneamento Básico", municipioId: "municipio-demo", etapa: "TERMO_REFERENCIA_MINUTA", responsavel: "carla", criado: "2026-08-28T09:00:00-03:00", tags: ["saneamento"], valor: "R$ 348.000,00", manterFluxo: {} },
  { id: "cmu4ujx29000ghby33ggyli5a", codigo: "CTR-2026-025", objeto: "Elaboração do Plano de Mobilidade Urbana", municipioId: "municipio-demo", etapa: "TERMO_REFERENCIA_ASSINADO", responsavel: "ana", criado: "2026-07-14T09:00:00-03:00", tags: ["mobilidade"], valor: "R$ 615.000,00", manterFluxo: { assinadoEm: "2026-08-04T15:20:00-03:00" } },
  { id: "contrato-demo-mariopolis-pccs", codigo: "CTR-2026-026", objeto: "Elaboração do Estatuto e Plano de Cargos, Carreira e Salários de Mariópolis", municipioId: "municipio-mariopolis", etapa: "TERMO_REFERENCIA_ASSINADO", responsavel: "bruno", criado: "2026-06-30T09:00:00-03:00", tags: ["estatuto", "pccs"], valor: "R$ 214.000,00", assinatura: assinaturaCompleta("Mariópolis", "2026-07-23T11:00:00-03:00") },
  { id: "contrato-demo-pato-branco-pd", codigo: "CTR-2026-027", objeto: "Revisão do Plano Diretor Municipal de Pato Branco", municipioId: "municipio-pato-branco", etapa: "TERMO_REFERENCIA_ASSINADO", responsavel: "ana", criado: "2026-05-25T09:00:00-03:00", tags: ["plano-diretor", "prioritário"], valor: "R$ 748.000,00", assinatura: assinaturaCompleta("Pato Branco", "2026-06-18T10:00:00-03:00") },
  { id: "contrato-demo-coronel-vivida-phis", codigo: "CTR-2026-028", objeto: "Elaboração do Plano Municipal de Habitação de Interesse Social", municipioId: "municipio-coronel-vivida", etapa: "TERMO_REFERENCIA_ASSINADO", responsavel: "bruno", criado: "2026-07-10T09:00:00-03:00", tags: ["habitação"], valor: "R$ 176.500,00", assinatura: assinaturaCompleta("Coronel Vivida", "2026-08-03T16:00:00-03:00") },
  { id: "contrato-demo-palmas-pd", codigo: "CTR-2026-029", objeto: "Revisão do Plano Diretor Municipal de Palmas", municipioId: "municipio-palmas", etapa: "TERMO_REFERENCIA_MINUTA", responsavel: "ana", criado: "2026-08-24T09:00:00-03:00", tags: ["plano-diretor"], valor: "R$ 512.000,00", assinatura: [
    { userKey: "ana", status: "ASSINADO", quando: "2026-09-18T09:15:00-03:00", ip: "189.44.12.31" },
    { userKey: "carla", status: "ASSINADO", quando: "2026-09-18T09:20:00-03:00", ip: "189.44.12.47" },
    { nomeExterno: "Prefeito Municipal de Palmas", status: "PENDENTE" },
  ] },
  { id: "contrato-demo-mariopolis-mobilidade", codigo: "CTR-2026-030", objeto: "Elaboração do Plano de Mobilidade Urbana de Mariópolis", municipioId: "municipio-mariopolis", etapa: "DOCUMENTOS_CONTRATACAO", responsavel: "carla", criado: "2026-09-01T09:00:00-03:00", tags: ["mobilidade"], valor: "R$ 268.000,00" },
  { id: "contrato-demo-pato-branco-estatuto", codigo: "CTR-2026-031", objeto: "Elaboração do Estatuto do Servidor e PCCS de Pato Branco", municipioId: "municipio-pato-branco", etapa: "APROVACAO_ORCAMENTO", responsavel: "ana", criado: "2026-09-08T09:00:00-03:00", tags: ["estatuto", "pccs"], valor: "R$ 389.000,00" },
  { id: "contrato-demo-palmas-mobilidade", codigo: "CTR-2026-032", objeto: "Elaboração do Plano de Mobilidade Urbana de Palmas", municipioId: "municipio-palmas", etapa: "EMISSAO_ORCAMENTO", responsavel: "bruno", criado: "2026-09-14T09:00:00-03:00", tags: ["mobilidade"], valor: "R$ 301.500,00" },
  { id: "contrato-demo-coronel-vivida-pd", codigo: "CTR-2026-033", objeto: "Revisão do Plano Diretor Municipal de Coronel Vivida", municipioId: "municipio-coronel-vivida", etapa: "PEDIDO_ORCAMENTO", responsavel: "ana", criado: "2026-09-19T09:00:00-03:00", tags: ["plano-diretor"], valor: "R$ 420.000,00" },
];

/**
 * Documentos pedidos nas etapas do tipo Padrão (ver migração documentos_do_contrato): o orçamento do
 * CTP na emissão e a documentação de contratação. Etapas já passadas ficam com o arquivo que o
 * contrato já tinha; Mariópolis (CTR-2026-030) está no meio da coleta, para a demonstração.
 */
async function semearDocumentosPedidos(c: (typeof CONTRATOS)[number], idx: number, municipio: string) {
  type Pedido = { id: string; chave: string; nome: string; enviaQuem: "PREFEITURA" | "CTP"; status: "PENDENTE" | "ENVIADO" | "APROVADO"; anexoId: string | null; enviadoEm: string | null };
  const pedidos: Pedido[] = [];
  const IDX_EMISSAO = ETAPAS_CONTRATO.indexOf("EMISSAO_ORCAMENTO");
  const IDX_DOCUMENTOS = ETAPAS_CONTRATO.indexOf("DOCUMENTOS_CONTRATACAO");

  const orcamentoEntregue = idx > IDX_EMISSAO;
  pedidos.push({
    id: `doc-${c.id}-orcamento`, chave: "EMISSAO_ORCAMENTO", nome: "Proposta de orçamento", enviaQuem: "CTP",
    status: orcamentoEntregue ? "APROVADO" : "PENDENTE", anexoId: orcamentoEntregue ? `anexo-${c.id}-orcamento` : null, enviadoEm: orcamentoEntregue ? dia(c.criado, 4) : null,
  });
  if (idx <= IDX_DOCUMENTOS) {
    const emColeta = idx === IDX_DOCUMENTOS;
    const lista: [string, string, "PREFEITURA" | "CTP", "PENDENTE" | "ENVIADO" | "APROVADO"][] = [
      ["termo", "Termo de referência assinado", "PREFEITURA", "PENDENTE"],
      ["dotacao", "Declaração de dotação orçamentária", "PREFEITURA", emColeta ? "ENVIADO" : "PENDENTE"],
      ["fiscal", "Portaria de designação do fiscal do contrato", "PREFEITURA", "PENDENTE"],
      ["certidoes", "Certidões de regularidade fiscal e trabalhista", "CTP", emColeta ? "APROVADO" : "PENDENTE"],
      ["social", "Contrato social e cartão CNPJ", "CTP", emColeta ? "APROVADO" : "PENDENTE"],
    ];
    for (const [chave, nome, enviaQuem, status] of lista) {
      let anexoId: string | null = null;
      const quando = dia(c.criado, 10);
      if (status !== "PENDENTE") {
        anexoId = await anexo(`anexo-${c.id}-pedido-${chave}`, `${nome.replace(/[^\p{L}\p{N}]+/gu, "_")}.pdf`, [
          { estilo: "titulo", texto: nome },
          { estilo: "subtitulo", texto: `${c.codigo} · ${municipio}` },
          { estilo: "texto", texto: `Documento referente ao contrato "${c.objeto}".` },
          { estilo: "nota", texto: enviaQuem === "CTP" ? "Emitido pelo Cilla Tech Park." : `Emitido pela ${municipio}.` },
        ], quando, { contratoId: c.id });
      }
      pedidos.push({ id: `doc-${c.id}-${chave}`, chave: "DOCUMENTOS_CONTRATACAO", nome, enviaQuem, status, anexoId, enviadoEm: anexoId ? quando : null });
    }
  }
  for (const p of pedidos) {
    const dados = { contratoId: c.id, etapaChave: p.chave, nome: p.nome, enviaQuem: p.enviaQuem, status: p.status, anexoId: p.anexoId, enviadoEm: p.enviadoEm ? d(p.enviadoEm) : null, motivoRecusa: null };
    await prisma.documentoContrato.upsert({ where: { id: p.id }, update: dados, create: { id: p.id, ...dados } });
  }
}

async function semearContratos() {
  for (const c of CONTRATOS) {
    const dados = { objeto: c.objeto, contratanteId: c.municipioId, etapaAtual: c.etapa, responsavelId: U[c.responsavel], tags: JSON.stringify(c.tags), createdAt: d(c.criado) };
    await prisma.contrato.upsert({ where: { id: c.id }, update: dados, create: { id: c.id, codigo: c.codigo, ...dados } });

    const idx = ETAPAS_CONTRATO.indexOf(c.etapa);
    const municipio = NOME_MUNICIPIO[c.municipioId];
    const docs: { tipo: "pedido" | "orcamento" | "certidoes" | "minuta" | "assinado"; nome: string; quando: string }[] = [];
    docs.push({ tipo: "pedido", nome: "Pedido_de_Orcamento.pdf", quando: dia(c.criado, 0.05) });
    if (idx >= 2) docs.push({ tipo: "orcamento", nome: "Proposta_Tecnica_e_Comercial.pdf", quando: dia(c.criado, 4) });
    if (idx >= 4) docs.push({ tipo: "certidoes", nome: "Documentos_para_Contratacao.pdf", quando: dia(c.criado, 12) });
    if (idx >= 4) docs.push({ tipo: "minuta", nome: "Minuta_Contrato_e_Termo_de_Referencia.pdf", quando: dia(c.criado, 16) });
    if (idx >= 5) docs.push({ tipo: "assinado", nome: "Contrato_Assinado.pdf", quando: dia(c.criado, 24) });
    for (const doc of docs) {
      await anexo(`anexo-${c.id}-${doc.tipo}`, doc.nome, blocosDeDoc(docContrato(doc.tipo, c.codigo, c.objeto, municipio, c.valor)), doc.quando, { contratoId: c.id });
    }
    await semearDocumentosPedidos(c, idx, municipio);

    if (c.manterFluxo) {
      const fluxo = await prisma.fluxoAssinatura.findUnique({ where: { contratoId: c.id } });
      if (fluxo && c.manterFluxo.assinadoEm) {
        await prisma.signatario.updateMany({ where: { fluxoId: fluxo.id, status: "ASSINADO" }, data: { assinadoEm: d(c.manterFluxo.assinadoEm) } });
        await prisma.fluxoAssinatura.update({ where: { id: fluxo.id }, data: { createdAt: d(dia(c.manterFluxo.assinadoEm, -1)) } });
      }
    } else if (c.assinatura) {
      const concluido = c.assinatura.every((s) => s.status === "ASSINADO");
      const fluxo = await prisma.fluxoAssinatura.upsert({ where: { contratoId: c.id }, update: { concluido }, create: { contratoId: c.id, concluido, createdAt: d(dia(c.criado, 17)) } });
      for (const [i, s] of c.assinatura.entries()) {
        const id = `sig-${c.id}-${i}`;
        const dadosSig = { fluxoId: fluxo.id, userId: s.userKey ? U[s.userKey] : null, nomeExterno: s.nomeExterno ?? null, tipo: s.userKey ? "INTERNO" : "EXTERNO", status: s.status, assinadoEm: s.quando ? d(s.quando) : null, ipAssinatura: s.ip ?? null, provider: "local" };
        await prisma.signatario.upsert({ where: { id }, update: dadosSig, create: { id, ...dadosSig } });
      }
    }
  }
}

// ───────────────────────────── projetos, etapas, checklist, formulário, cronograma ─────────────────────────────

type ChecklistSpec = { id: string; nome: string; chave?: ChaveChecklist; status: "PENDENTE" | "ENVIADO" | "APROVADO"; enviado?: string };
type EtapaSpec = {
  id: string; ordem: number; nome: string; status: Status; prazo?: string; resp: Usuario; modo: "ARTIGO" | "DOCUMENTO_INTEIRO";
  info?: boolean; form?: boolean; check?: boolean; rev?: boolean;
  checklist?: ChecklistSpec[];
  formulario?: { respostas: Record<string, string>; por: Usuario; quando: string };
};
type EventoSpec = { id: string; data: string; titulo: string; descricao: string; resp: string };
type ProjetoSpec = { id: string; codigo: string; tipo: string; municipioId: string; contratoId: string; vigencia: string; resp: Usuario; criado: string; tags: string[]; etapas: EtapaSpec[]; eventos: EventoSpec[] };

const CHECK_PCCS = (p: string, m: { lei: string; org: string; cargos: string; folha: string; leg: string }, quando: string[]): ChecklistSpec[] => [
  { id: `check-${p}-lei`, nome: "Lei orgânica municipal", chave: "lei-organica", status: m.lei as ChecklistSpec["status"], enviado: quando[0] },
  { id: `check-${p}-org`, nome: "Organograma atual", chave: "organograma", status: m.org as ChecklistSpec["status"], enviado: quando[1] },
  { id: `check-${p}-cargos`, nome: "Relação completa de cargos", chave: "cargos", status: m.cargos as ChecklistSpec["status"], enviado: quando[2] },
  { id: `check-${p}-folha`, nome: "Folha de pagamento — últimos 12 meses", chave: "folha", status: m.folha as ChecklistSpec["status"], enviado: quando[3] },
  { id: `check-${p}-leg`, nome: "Legislação complementar", chave: "legislacao", status: m.leg as ChecklistSpec["status"], enviado: quando[4] },
];
const CHECK_PD = (p: string, quando: string[]): ChecklistSpec[] => [
  { id: `check-${p}-perimetro`, nome: "Lei do perímetro urbano", chave: "perimetro", status: "APROVADO", enviado: quando[0] },
  { id: `check-${p}-usosolo`, nome: "Legislação de uso e ocupação do solo vigente", chave: "uso-solo", status: "APROVADO", enviado: quando[1] },
  { id: `check-${p}-ppa`, nome: "Plano Plurianual (PPA) vigente", chave: "ppa", status: "APROVADO", enviado: quando[2] },
  { id: `check-${p}-carto`, nome: "Base cartográfica georreferenciada", chave: "cartografia", status: "APROVADO", enviado: quando[3] },
  { id: `check-${p}-infra`, nome: "Relatório de infraestrutura urbana", chave: "infra", status: "APROVADO", enviado: quando[4] },
];

const PROJETOS: ProjetoSpec[] = [
  {
    id: "projeto-demo-guarapuava", codigo: "PRJ-2026-014", tipo: "ESTATUTO_PCCS", municipioId: "municipio-demo", contratoId: "contrato-demo-guarapuava", vigencia: "2026-12-22T12:00:00Z", resp: "ana", criado: "2026-06-05T09:00:00-03:00", tags: ["PCCS", "Guarapuava"],
    etapas: [
      { id: "etapa-info-demo", ordem: 1, nome: "Informações iniciais", status: "CONCLUIDA", resp: "ana", modo: "ARTIGO", info: true },
      {
        id: "etapa-docs-demo", ordem: 2, nome: "Documentos iniciais", status: "CONCLUIDA", prazo: "2026-07-10T12:00:00Z", resp: "ana", modo: "ARTIGO", form: true, check: true,
        checklist: [
          { id: "check-lei", nome: "Lei orgânica municipal", chave: "lei-organica", status: "APROVADO", enviado: "2026-06-19T15:30:00-03:00" },
          { id: "check-org", nome: "Organograma atual", chave: "organograma", status: "APROVADO", enviado: "2026-06-23T14:45:00-03:00" },
          { id: "check-cargos", nome: "Relação completa de cargos", chave: "cargos", status: "APROVADO", enviado: "2026-06-30T11:10:00-03:00" },
          { id: "check-folha", nome: "Folha de pagamento — últimos 12 meses", chave: "folha", status: "APROVADO", enviado: "2026-06-30T11:12:00-03:00" },
          { id: "check-leg", nome: "Legislação complementar", chave: "legislacao", status: "APROVADO", enviado: "2026-07-01T08:48:00-03:00" },
        ],
        formulario: { por: "marina", quando: "2026-06-19T15:35:00-03:00", respostas: {
          lei_organica_url: "Anexada ao checklist — Lei Orgânica consolidada até a Emenda nº 42/2024",
          organograma: "Gabinete do Prefeito, Procuradoria, 12 secretarias municipais e 3 autarquias (estrutura completa no PDF anexado)",
          quadro_pessoal: "4.216 servidores ativos: 3.604 efetivos, 388 em comissão e 224 contratados temporários",
          responsavel_contato: "Marina Kowalski — Secretária de Administração — (42) 3621-3000",
        } },
      },
      { id: "etapa-diagnostico-demo", ordem: 3, nome: "Diagnóstico inicial", status: "CONCLUIDA", prazo: "2026-08-14T12:00:00Z", resp: "ana", modo: "ARTIGO" },
      { id: "etapa-minuta-demo", ordem: 4, nome: "Minutas versão 01", status: "AGUARDANDO_MUNICIPIO", prazo: "2026-09-28T12:00:00Z", resp: "ana", modo: "ARTIGO", rev: true },
      { id: "etapa-devolutiva-demo", ordem: 5, nome: "Análise e devolutiva 01", status: "NAO_INICIADA", prazo: "2026-10-23T12:00:00Z", resp: "ana", modo: "ARTIGO", rev: true },
      { id: "etapa-minuta2-demo", ordem: 6, nome: "Minutas 02", status: "NAO_INICIADA", prazo: "2026-11-20T12:00:00Z", resp: "ana", modo: "ARTIGO", rev: true },
      { id: "etapa-final-demo", ordem: 7, nome: "Devolutiva 02", status: "NAO_INICIADA", prazo: "2026-12-11T12:00:00Z", resp: "ana", modo: "ARTIGO", rev: true },
    ],
    eventos: [
      { id: "evento-kickoff", data: "2026-06-16T12:00:00Z", titulo: "Reunião de kick-off", descricao: "Alinhamento do cronograma e dos responsáveis.", resp: "Ana Coordenadora" },
      { id: "evento-documentos", data: "2026-07-10T12:00:00Z", titulo: "Entrega dos documentos iniciais", descricao: "Checklist obrigatório concluído e validado pela equipe.", resp: "Prefeitura de Guarapuava" },
      { id: "evento-diagnostico", data: "2026-08-14T12:00:00Z", titulo: "Diagnóstico inicial", descricao: "Apresentação técnica dos achados preliminares.", resp: "Bruno Técnico" },
      { id: "ev-pccs-v1", data: "2026-08-19T12:00:00Z", titulo: "Entrega da minuta v1", descricao: "Primeira versão dos artigos 8º a 10 enviada para revisão.", resp: "Ana Coordenadora" },
      { id: "ev-pccs-oficina", data: "2026-09-08T12:00:00Z", titulo: "Oficina de validação com servidores", descricao: "Apresentação da estrutura de carreira aos representantes dos servidores.", resp: "Carla Jurídica" },
      { id: "ev-pccs-v3", data: "2026-09-11T12:00:00Z", titulo: "Entrega da minuta v3", descricao: "Versão 3 com artigos 8º a 15 disponível na plataforma.", resp: "Carla Jurídica" },
      { id: "ev-pccs-devolutiva", data: "2026-09-28T12:00:00Z", titulo: "Prazo de devolutiva do município", descricao: "Retorno sobre os artigos pendentes (11, 12 e 15) e ajustes dos reprovados.", resp: "Prefeitura de Guarapuava" },
      { id: "ev-pccs-audiencia", data: "2026-11-05T12:00:00Z", titulo: "Audiência pública do Estatuto", descricao: "Apresentação da minuta consolidada à comunidade e aos servidores.", resp: "Ana Coordenadora" },
    ],
  },
  {
    id: "projeto-demo-plano-diretor", codigo: "PRJ-2026-021", tipo: "PLANO_DIRETOR", municipioId: "municipio-demo", contratoId: "contrato-demo-plano-diretor", vigencia: "2027-03-30T12:00:00Z", resp: "bruno", criado: "2026-06-28T09:00:00-03:00", tags: ["Plano Diretor", "Guarapuava"],
    etapas: [
      { id: "etapa-pd-info-demo", ordem: 1, nome: "Informações iniciais", status: "CONCLUIDA", resp: "bruno", modo: "DOCUMENTO_INTEIRO", info: true },
      {
        id: "etapa-pd-docs-demo", ordem: 2, nome: "Documentos iniciais", status: "CONCLUIDA", prazo: "2026-07-16T12:00:00Z", resp: "bruno", modo: "DOCUMENTO_INTEIRO", form: true, check: true,
        checklist: CHECK_PD("pd-guar", ["2026-07-08T16:30:00-03:00", "2026-07-08T16:35:00-03:00", "2026-07-08T16:40:00-03:00", "2026-07-14T09:10:00-03:00", "2026-07-14T09:12:00-03:00"]),
        formulario: { por: "marina", quando: "2026-07-14T09:20:00-03:00", respostas: {
          lei_organica_url: "Lei Orgânica anexada no projeto de Estatuto e PCCS (mesmo município)",
          organograma: "Estrutura vigente: 12 secretarias; Secretaria de Planejamento responsável pelo Plano Diretor",
          quadro_pessoal: "Equipe de 9 técnicos designados para acompanhar o Plano Diretor (Planejamento, Obras e Meio Ambiente)",
          responsavel_contato: "Marina Kowalski — Secretária de Administração — (42) 3621-3000",
        } },
      },
      { id: "etapa-pd-fase1-demo", ordem: 3, nome: "Fase 01 — Leitura técnica e comunitária", status: "AGUARDANDO_MUNICIPIO", prazo: "2026-09-10T12:00:00Z", resp: "bruno", modo: "DOCUMENTO_INTEIRO", rev: true },
      { id: "etapa-pd-fase2-demo", ordem: 4, nome: "Fase 02 — Diretrizes e propostas", status: "NAO_INICIADA", prazo: "2026-11-06T12:00:00Z", resp: "bruno", modo: "DOCUMENTO_INTEIRO", rev: true },
      { id: "etapa-pd-fase3-demo", ordem: 5, nome: "Fase 03 — Minuta do projeto de lei", status: "NAO_INICIADA", prazo: "2026-12-18T12:00:00Z", resp: "bruno", modo: "ARTIGO", rev: true },
      { id: "etapa-pd-fase4-demo", ordem: 6, nome: "Fase 04 — Audiência pública", status: "NAO_INICIADA", prazo: "2027-02-12T12:00:00Z", resp: "bruno", modo: "DOCUMENTO_INTEIRO", check: true,
      checklist: [
        { id: "check-pd-guar-aud-edital", nome: "Edital de convocação da audiência pública", status: "PENDENTE" },
        { id: "check-pd-guar-aud-ata", nome: "Ata da audiência pública", status: "PENDENTE" },
        { id: "check-pd-guar-aud-presenca", nome: "Lista de presença", status: "PENDENTE" },
      ] },
      { id: "etapa-pd-fase5-demo", ordem: 7, nome: "Fase 05 — Versão final e envio à Câmara", status: "NAO_INICIADA", prazo: "2027-03-26T12:00:00Z", resp: "bruno", modo: "DOCUMENTO_INTEIRO", rev: true },
    ],
    eventos: [
      { id: "ev-pd-kick", data: "2026-06-30T12:00:00Z", titulo: "Reunião de kick-off do Plano Diretor", descricao: "Apresentação da metodologia e do cronograma às secretarias envolvidas.", resp: "Bruno Técnico" },
      { id: "ev-pd-oficina", data: "2026-08-13T12:00:00Z", titulo: "Oficina participativa — leitura comunitária", descricao: "Levantamento das percepções da população em 4 regiões da cidade.", resp: "Bruno Técnico" },
      { id: "ev-pd-v1", data: "2026-08-21T12:00:00Z", titulo: "Entrega da Fase 01 — versão 1", descricao: "Diagnóstico territorial, zoneamento e mobilidade.", resp: "Bruno Técnico" },
      { id: "ev-pd-v2", data: "2026-09-17T12:00:00Z", titulo: "Entrega da Fase 01 — versão 2", descricao: "Versão ampliada com habitação de interesse social e meio ambiente.", resp: "Bruno Técnico" },
      { id: "ev-pd-validacao", data: "2026-10-01T12:00:00Z", titulo: "Reunião de validação do zoneamento", descricao: "Planejamento, Procuradoria e equipe técnica do CTP.", resp: "Prefeitura de Guarapuava" },
      { id: "ev-pd-audiencia", data: "2026-11-12T12:00:00Z", titulo: "Audiência pública — Fase 01", descricao: "Apresentação do diagnóstico e das diretrizes à comunidade.", resp: "Ana Coordenadora" },
    ],
  },
  {
    id: "cmu4ut0jq0015hby3wl6mgkpo", codigo: "PRJ-2026-025", tipo: "PLANO_DE_MOBILIDADE", municipioId: "municipio-demo", contratoId: "cmu4ujx29000ghby33ggyli5a", vigencia: "2027-06-30T12:00:00Z", resp: "ana", criado: "2026-08-05T09:00:00-03:00", tags: ["mobilidade"],
    etapas: [
      { id: "cmu4ut0jr0017hby3toavr3eo", ordem: 0, nome: "Informações iniciais", status: "CONCLUIDA", resp: "ana", modo: "ARTIGO", info: true },
      { id: "cmu4ut0jr0018hby3if7urgkn", ordem: 1, nome: "Diagnóstico de mobilidade", status: "AGUARDANDO_MUNICIPIO", prazo: "2026-10-05T12:00:00Z", resp: "ana", modo: "DOCUMENTO_INTEIRO", rev: true },
    ],
    eventos: [
      { id: "ev-mob-kick", data: "2026-08-06T12:00:00Z", titulo: "Abertura do projeto de mobilidade", descricao: "Alinhamento com a Diretoria de Trânsito e a Secretaria de Planejamento.", resp: "Ana Coordenadora" },
      { id: "ev-mob-contagens", data: "2026-08-21T12:00:00Z", titulo: "Pesquisa de contagem volumétrica", descricao: "26 seções de contagem, das 6h às 20h, durante cinco dias úteis.", resp: "Bruno Técnico" },
      { id: "ev-mob-v1", data: "2026-09-15T12:00:00Z", titulo: "Entrega do diagnóstico — versão 1", descricao: "Sistema viário, transporte coletivo, mobilidade ativa e logística.", resp: "Bruno Técnico" },
      { id: "ev-mob-reuniao", data: "2026-09-25T12:00:00Z", titulo: "Reunião com a Diretoria de Trânsito", descricao: "Consolidar dados de subsídio e sinistros de trânsito.", resp: "Ana Coordenadora" },
      { id: "ev-mob-prazo", data: "2026-10-05T12:00:00Z", titulo: "Prazo de validação do diagnóstico", descricao: "Retorno do município sobre os comentários da versão 1.", resp: "Prefeitura de Guarapuava" },
    ],
  },
  {
    id: "projeto-demo-mariopolis-pccs", codigo: "PRJ-2026-031", tipo: "ESTATUTO_PCCS", municipioId: "municipio-mariopolis", contratoId: "contrato-demo-mariopolis-pccs", vigencia: "2027-05-28T12:00:00Z", resp: "bruno", criado: "2026-07-27T09:00:00-03:00", tags: ["PCCS", "Mariópolis"],
    etapas: [
      { id: "etapa-mar-info", ordem: 0, nome: "Informações iniciais", status: "CONCLUIDA", resp: "bruno", modo: "ARTIGO", info: true },
      {
        id: "etapa-mar-docs", ordem: 1, nome: "Documentos iniciais", status: "EM_ANDAMENTO", prazo: "2026-09-24T12:00:00Z", resp: "bruno", modo: "ARTIGO", form: true, check: true,
        checklist: CHECK_PCCS("mar", { lei: "APROVADO", org: "APROVADO", cargos: "ENVIADO", folha: "ENVIADO", leg: "PENDENTE" }, ["2026-08-10T16:15:00-03:00", "2026-08-25T09:58:00-03:00", "2026-08-31T11:20:00-03:00", "2026-09-15T09:48:00-03:00", ""]),
        formulario: { por: "helena", quando: "2026-08-10T16:18:00-03:00", respostas: {
          lei_organica_url: "Anexada ao checklist — Lei Orgânica de Mariópolis com emendas até 2023",
          organograma: "Gabinete, Procuradoria e 7 secretarias (reestruturação de julho de 2026)",
          quadro_pessoal: "312 servidores ativos: 241 efetivos, 34 em comissão e 37 contratados temporários",
          responsavel_contato: "Helena Bittencourt — Secretária de Administração — (46) 3232-1200",
        } },
      },
      { id: "etapa-mar-diag", ordem: 2, nome: "Diagnóstico inicial", status: "NAO_INICIADA", prazo: "2026-10-30T12:00:00Z", resp: "bruno", modo: "DOCUMENTO_INTEIRO", rev: true },
      { id: "etapa-mar-min1", ordem: 3, nome: "Minutas versão 01", status: "NAO_INICIADA", prazo: "2026-12-11T12:00:00Z", resp: "bruno", modo: "ARTIGO", rev: true },
      { id: "etapa-mar-dev1", ordem: 4, nome: "Análise e devolutiva 01", status: "NAO_INICIADA", prazo: "2027-01-22T12:00:00Z", resp: "bruno", modo: "DOCUMENTO_INTEIRO", rev: true },
      { id: "etapa-mar-min2", ordem: 5, nome: "Minutas 02", status: "NAO_INICIADA", prazo: "2027-03-12T12:00:00Z", resp: "bruno", modo: "ARTIGO", rev: true },
      { id: "etapa-mar-dev2", ordem: 6, nome: "Devolutiva 02", status: "NAO_INICIADA", prazo: "2027-04-30T12:00:00Z", resp: "bruno", modo: "DOCUMENTO_INTEIRO", rev: true },
    ],
    eventos: [
      { id: "ev-mar-kick", data: "2026-08-03T12:00:00Z", titulo: "Kick-off por videoconferência", descricao: "Apresentação da equipe e do cronograma ao Prefeito e às secretarias.", resp: "Ana Coordenadora" },
      { id: "ev-mar-visita", data: "2026-09-24T12:00:00Z", titulo: "Visita técnica à Prefeitura", descricao: "Coleta de documentos e reunião com o RH e a assessoria jurídica.", resp: "Bruno Técnico" },
      { id: "ev-mar-docs", data: "2026-09-24T12:30:00Z", titulo: "Prazo dos documentos iniciais", descricao: "Falta apenas a legislação complementar consolidada.", resp: "Prefeitura de Mariópolis" },
      { id: "ev-mar-diag", data: "2026-10-30T12:00:00Z", titulo: "Entrega do diagnóstico inicial", descricao: "Apresentação dos achados sobre cargos, carreiras e remuneração.", resp: "Bruno Técnico" },
    ],
  },
  {
    id: "projeto-demo-pato-branco-pd", codigo: "PRJ-2026-032", tipo: "PLANO_DIRETOR", municipioId: "municipio-pato-branco", contratoId: "contrato-demo-pato-branco-pd", vigencia: "2027-05-14T12:00:00Z", resp: "ana", criado: "2026-06-22T09:00:00-03:00", tags: ["Plano Diretor", "Pato Branco"],
    etapas: [
      { id: "etapa-pb-info", ordem: 0, nome: "Informações iniciais", status: "CONCLUIDA", resp: "ana", modo: "DOCUMENTO_INTEIRO", info: true },
      {
        id: "etapa-pb-docs", ordem: 1, nome: "Documentos iniciais", status: "CONCLUIDA", prazo: "2026-07-24T12:00:00Z", resp: "ana", modo: "DOCUMENTO_INTEIRO", form: true, check: true,
        checklist: CHECK_PD("pb", ["2026-07-06T15:10:00-03:00", "2026-07-06T15:12:00-03:00", "2026-07-09T10:00:00-03:00", "2026-07-06T15:15:00-03:00", "2026-07-07T09:30:00-03:00"]),
        formulario: { por: "juliana", quando: "2026-07-15T09:35:00-03:00", respostas: {
          lei_organica_url: "Lei Orgânica anexada ao chat da etapa de informações iniciais",
          organograma: "Diretoria de Planejamento Urbano vinculada à Secretaria de Obras e Planejamento",
          quadro_pessoal: "Equipe do Plano Diretor: 6 técnicos da Diretoria de Planejamento e 2 da Procuradoria",
          responsavel_contato: "Juliana Menegatti — Diretora de Planejamento Urbano — (46) 3220-1500",
        } },
      },
      { id: "etapa-pb-fase1", ordem: 2, nome: "Fase 01 — Leitura técnica e comunitária", status: "AGUARDANDO_MUNICIPIO", prazo: "2026-10-02T12:00:00Z", resp: "ana", modo: "DOCUMENTO_INTEIRO", rev: true },
      { id: "etapa-pb-fase2", ordem: 3, nome: "Fase 02 — Diretrizes e propostas", status: "NAO_INICIADA", prazo: "2026-11-27T12:00:00Z", resp: "ana", modo: "DOCUMENTO_INTEIRO", rev: true },
      { id: "etapa-pb-fase3", ordem: 4, nome: "Fase 03 — Minuta do projeto de lei", status: "NAO_INICIADA", prazo: "2027-01-29T12:00:00Z", resp: "ana", modo: "ARTIGO", rev: true },
      { id: "etapa-pb-fase4", ordem: 5, nome: "Fase 04 — Audiência pública", status: "NAO_INICIADA", prazo: "2027-03-19T12:00:00Z", resp: "ana", modo: "DOCUMENTO_INTEIRO", check: true,
      checklist: [
        { id: "check-pb-aud-edital", nome: "Edital de convocação da audiência pública", status: "PENDENTE" },
        { id: "check-pb-aud-ata", nome: "Ata da audiência pública", status: "PENDENTE" },
        { id: "check-pb-aud-presenca", nome: "Lista de presença", status: "PENDENTE" },
      ] },
      { id: "etapa-pb-fase5", ordem: 6, nome: "Fase 05 — Versão final e envio à Câmara", status: "NAO_INICIADA", prazo: "2027-04-23T12:00:00Z", resp: "ana", modo: "DOCUMENTO_INTEIRO", rev: true },
    ],
    eventos: [
      { id: "ev-pb-kick", data: "2026-06-24T12:00:00Z", titulo: "Reunião de kick-off", descricao: "Apresentação do cronograma ao Prefeito e ao Conselho da Cidade.", resp: "Ana Coordenadora" },
      { id: "ev-pb-oficina", data: "2026-08-20T12:00:00Z", titulo: "Oficina participativa — leitura comunitária", descricao: "Participação de 86 moradores e representantes de entidades.", resp: "Ana Coordenadora" },
      { id: "ev-pb-v1", data: "2026-09-14T12:00:00Z", titulo: "Entrega da Fase 01 — versão 1", descricao: "Cinco seções para revisão do município.", resp: "Bruno Técnico" },
      { id: "ev-pb-conselho", data: "2026-09-24T12:00:00Z", titulo: "Reunião do Conselho da Cidade", descricao: "Discussão sobre a ampliação do perímetro urbano.", resp: "Prefeitura de Pato Branco" },
      { id: "ev-pb-prazo", data: "2026-10-02T12:00:00Z", titulo: "Prazo da Fase 01", descricao: "Fechamento dos comentários e geração da versão 2.", resp: "Ana Coordenadora" },
    ],
  },
  {
    id: "projeto-demo-coronel-vivida-phis", codigo: "PRJ-2026-033", tipo: "PERSONALIZADO", municipioId: "municipio-coronel-vivida", contratoId: "contrato-demo-coronel-vivida-phis", vigencia: "2026-12-18T12:00:00Z", resp: "bruno", criado: "2026-08-06T09:00:00-03:00", tags: ["habitação", "Coronel Vivida"],
    etapas: [
      { id: "etapa-cv-info", ordem: 0, nome: "Informações iniciais", status: "CONCLUIDA", resp: "bruno", modo: "ARTIGO", info: true },
      {
        id: "etapa-cv-docs", ordem: 1, nome: "Documentos iniciais", status: "CONCLUIDA", prazo: "2026-08-25T12:00:00Z", resp: "bruno", modo: "ARTIGO", form: true, check: true,
        checklist: [
          { id: "check-cv-cadastro", nome: "Cadastro habitacional existente", chave: "cadastro-habitacional", status: "APROVADO", enviado: "2026-08-21T16:00:00-03:00" },
          { id: "check-cv-pd", nome: "Plano Diretor vigente", chave: "plano-diretor-vigente", status: "APROVADO", enviado: "2026-08-21T16:05:00-03:00" },
          { id: "check-cv-mapa", nome: "Mapa dos bairros prioritários", chave: "mapa-bairros", status: "APROVADO", enviado: "2026-08-21T16:08:00-03:00" },
        ],
        formulario: { por: "tatiane", quando: "2026-08-21T16:12:00-03:00", respostas: {
          lei_organica_url: "Lei Orgânica anexada (texto consolidado)",
          organograma: "Secretaria de Obras responsável pela política habitacional, com apoio da Assistência Social",
          quadro_pessoal: "Equipe de 5 servidores designados para acompanhar o levantamento de campo",
          responsavel_contato: "Tatiane Wolff — Secretária de Obras — (46) 3232-8000",
        } },
      },
      { id: "etapa-cv-fase1", ordem: 2, nome: "Fase 01", status: "EM_ANDAMENTO", prazo: "2026-10-16T12:00:00Z", resp: "bruno", modo: "DOCUMENTO_INTEIRO", rev: true },
    ],
    eventos: [
      { id: "ev-cv-kick", data: "2026-08-07T12:00:00Z", titulo: "Abertura do projeto", descricao: "Alinhamento inicial com a Secretaria de Obras.", resp: "Ana Coordenadora" },
      { id: "ev-cv-campo", data: "2026-09-08T12:00:00Z", titulo: "Início do levantamento de campo", descricao: "Equipe do CTP nos bairros prioritários, com agentes da Prefeitura.", resp: "Bruno Técnico" },
      { id: "ev-cv-fim", data: "2026-09-24T12:00:00Z", titulo: "Fim previsto do levantamento", descricao: "Prazo estendido para incluir o bairro Santa Rita.", resp: "Bruno Técnico" },
      { id: "ev-cv-relatorio", data: "2026-10-16T12:00:00Z", titulo: "Entrega do relatório da Fase 01", descricao: "Cadastro habitacional consolidado e mapa de demandas.", resp: "Bruno Técnico" },
    ],
  },
];

async function semearProjetos() {
  for (const p of PROJETOS) {
    const municipio = NOME_MUNICIPIO[p.municipioId];
    const dadosProjeto = { tipo: p.tipo, contratanteId: p.municipioId, contratoOrigemId: p.contratoId, dataVigencia: d(p.vigencia), responsavelId: U[p.resp], tags: JSON.stringify(p.tags), createdAt: d(p.criado) };
    await prisma.projeto.upsert({ where: { id: p.id }, update: dadosProjeto, create: { id: p.id, codigo: p.codigo, ...dadosProjeto } });

    for (const e of p.etapas) {
      const dados = {
        nome: e.nome, ordem: e.ordem, tipoFluxo: p.tipo, modoRevisao: e.modo, status: e.status, prazo: e.prazo ? d(e.prazo) : null, responsavelId: U[e.resp],
        temInformacoesProjeto: e.info ?? false, temFormulario: e.form ?? false, temChecklist: e.check ?? false, temRevisao: e.rev ?? false,
      };
      await prisma.etapaProjeto.upsert({ where: { id: e.id }, update: dados, create: { id: e.id, projetoId: p.id, ...dados } });

      for (const c of e.checklist ?? []) {
        let arquivoId: string | null = null;
        if (c.status !== "PENDENTE" && c.enviado && c.chave) {
          arquivoId = await anexo(`anexo-${c.id}`, `${c.nome.replace(/[^\p{L}\p{N}]+/gu, "_")}.pdf`, blocosDeDoc(docChecklist(c.chave, municipio)), c.enviado);
        }
        const dadosItem = { etapaId: e.id, nome: c.nome, status: c.status, arquivoId, createdAt: d(p.criado) };
        await prisma.checklistItem.upsert({ where: { id: c.id }, update: dadosItem, create: { id: c.id, ...dadosItem } });
      }

      if (e.formulario) {
        const dadosForm = { respostas: JSON.stringify(e.formulario.respostas), enviadoPorId: U[e.formulario.por], createdAt: d(e.formulario.quando) };
        await prisma.formularioResposta.upsert({ where: { etapaId: e.id }, update: dadosForm, create: { etapaId: e.id, ...dadosForm } });
      }
    }

    for (const ev of p.eventos) {
      const dadosEv = { projetoId: p.id, data: d(ev.data), titulo: ev.titulo, descricao: ev.descricao, responsavelNome: ev.resp };
      await prisma.eventoCronograma.upsert({ where: { id: ev.id }, update: dadosEv, create: { id: ev.id, ...dadosEv } });
    }
  }
}

// ───────────────────────────── conversas por etapa ─────────────────────────────

async function semearConversas() {
  for (const [etapaId, mensagens] of Object.entries(CONVERSAS)) {
    for (const [i, msg] of mensagens.entries()) {
      const id = msg.idExistente ?? `chat-${etapaId}-${i}`;
      let anexoId: string | null = null;
      if (msg.anexo) {
        anexoId = await anexo(`anexo-chat-${etapaId}-${i}`, msg.anexo.nome, [{ estilo: "titulo", texto: msg.anexo.titulo }, ...msg.anexo.paragrafos.map((texto): Bloco => ({ estilo: "texto", texto }))], msg.quando);
      }
      const dados = { etapaId, autorId: U[msg.autor], texto: msg.texto, anexoId, createdAt: d(msg.quando) };
      await prisma.mensagemChat.upsert({ where: { id }, update: dados, create: { id, ...dados } });
    }
  }
}

// ───────────────────────────── documentos: versões, artigos, seções, grifos ─────────────────────────────

type DocSpec = {
  id: string; etapaId: string; versao: number; nomeArquivo: string; criador: Usuario; quando: string; titulo: string; municipio: string;
} & (
  | { modo: "ARTIGO"; artigos: ArtigoSpec[]; prefixoUnidade?: string }
  | { modo: "SECOES"; secoes: SecaoSpec[]; inteiro: { status: "PENDENTE" | "APROVADO" | "REPROVADO"; comentario?: string; revisor: Usuario } }
  | { modo: "EXISTENTE"; inteiro: { status: "PENDENTE" | "APROVADO" | "REPROVADO"; comentario?: string; unidadeId: string }; secoesTitulos: string[]; comentariosQuando: string }
);

const DOCS: DocSpec[] = [
  { id: "documento-pccs-guarapuava-v1", etapaId: "etapa-minuta-demo", versao: 1, nomeArquivo: "minuta_estatuto_pccs_v1.pdf", criador: "ana", quando: "2026-08-19T13:30:00-03:00", titulo: "Minuta do Estatuto e PCCS — versão 1", municipio: "Guarapuava", modo: "ARTIGO", artigos: ARTIGOS_PCCS_V1 },
  { id: "documento-pccs-guarapuava-v2", etapaId: "etapa-minuta-demo", versao: 2, nomeArquivo: "minuta_estatuto_pccs_v2.pdf", criador: "bruno", quando: "2026-09-02T10:30:00-03:00", titulo: "Minuta do Estatuto e PCCS — versão 2", municipio: "Guarapuava", modo: "ARTIGO", artigos: ARTIGOS_PCCS_V2 },
  { id: "documento-minuta-demo", etapaId: "etapa-minuta-demo", versao: 3, nomeArquivo: "minuta_estatuto_pccs_v3.pdf", criador: "carla", quando: "2026-09-11T15:00:00-03:00", titulo: "Minuta do Estatuto e PCCS — versão 3", municipio: "Guarapuava", modo: "ARTIGO", artigos: ARTIGOS_PCCS_V3, prefixoUnidade: "unidade-demo-" },
  { id: "documento-plano-diretor-demo", etapaId: "etapa-pd-fase1-demo", versao: 1, nomeArquivo: "plano_diretor_fase1_v1.pdf", criador: "bruno", quando: "2026-08-21T14:30:00-03:00", titulo: "Plano Diretor de Guarapuava — Fase 01 (versão 1)", municipio: "Guarapuava", modo: "EXISTENTE",
    inteiro: { status: "REPROVADO", comentario: "Faltam os dados do último censo e o detalhamento do zoneamento. Ver comentários nas três seções.", unidadeId: "unidade-pd-documento-inteiro" },
    secoesTitulos: ["Diagnóstico territorial", "Zoneamento urbano proposto", "Diretrizes de mobilidade"], comentariosQuando: "2026-08-27T16:00:00-03:00" },
  { id: "documento-pd-guarapuava-v2", etapaId: "etapa-pd-fase1-demo", versao: 2, nomeArquivo: "plano_diretor_fase1_v2.pdf", criador: "bruno", quando: "2026-09-17T17:50:00-03:00", titulo: "Plano Diretor de Guarapuava — Fase 01 (versão 2)", municipio: "Guarapuava", modo: "SECOES", secoes: SECOES_PD_GUARAPUAVA_V2, inteiro: { status: "PENDENTE", revisor: "bruno" } },
  { id: "documento-pd-patobranco-v1", etapaId: "etapa-pb-fase1", versao: 1, nomeArquivo: "plano_diretor_pato_branco_fase1_v1.pdf", criador: "bruno", quando: "2026-09-14T15:30:00-03:00", titulo: "Plano Diretor de Pato Branco — Fase 01 (versão 1)", municipio: "Pato Branco", modo: "SECOES", secoes: SECOES_PD_PATOBRANCO_V1, inteiro: { status: "PENDENTE", revisor: "bruno" } },
  { id: "documento-mobilidade-guarapuava-v1", etapaId: "cmu4ut0jr0018hby3if7urgkn", versao: 1, nomeArquivo: "diagnostico_mobilidade_v1.pdf", criador: "bruno", quando: "2026-09-15T09:30:00-03:00", titulo: "Diagnóstico de Mobilidade Urbana de Guarapuava (versão 1)", municipio: "Guarapuava", modo: "SECOES", secoes: SECOES_MOBILIDADE_V1, inteiro: { status: "PENDENTE", revisor: "bruno" } },
];

async function semearDocumentos() {
  for (const doc of DOCS) {
    const anexoId = `anexo-${doc.id}`;
    const cabecalho: Bloco[] = [
      { estilo: "titulo", texto: doc.titulo },
      { estilo: "nota", texto: `Documento para revisão — ${doc.municipio} — emitido em ${d(doc.quando).toLocaleDateString("pt-BR")} — CTP Work` },
    ];
    let blocos: Bloco[] = cabecalho;
    if (doc.modo === "ARTIGO") {
      blocos = [...cabecalho, ...doc.artigos.flatMap((a): Bloco[] => [{ estilo: "subtitulo", texto: a.identificador }, ...a.conteudo.split("\n").map((texto): Bloco => ({ estilo: "texto", texto }))])];
    } else if (doc.modo === "SECOES") {
      blocos = [...cabecalho, ...doc.secoes.flatMap((s, i): Bloco[] => [{ estilo: "subtitulo", texto: `${i + 1}. ${s.titulo}` }, { estilo: "texto", texto: s.conteudo }])];
    } else {
      blocos = [...cabecalho, { estilo: "texto", texto: "Versão preliminar apresentada em 21/08/2026. Os comentários do município sobre esta versão foram incorporados na versão 2." }, ...doc.secoesTitulos.map((t, i): Bloco => ({ estilo: "item", texto: `${i + 1}. ${t}` }))];
    }
    await anexo(anexoId, doc.nomeArquivo, blocos, doc.quando);

    const dadosDoc = { etapaId: doc.etapaId, versao: doc.versao, nomeArquivo: doc.nomeArquivo, arquivoId: anexoId, criadoPorId: U[doc.criador], createdAt: d(doc.quando), enviadoEm: d(doc.quando) };
    await prisma.documentoVersionado.upsert({ where: { id: doc.id }, update: dadosDoc, create: { id: doc.id, ...dadosDoc } });

    if (doc.modo === "ARTIGO") {
      for (const [i, a] of doc.artigos.entries()) {
        const id = doc.prefixoUnidade ? `${doc.prefixoUnidade}${i + 1}` : `${doc.id}-a${i + 1}`;
        const dados = { documentoId: doc.id, tipo: "ARTIGO", identificador: a.identificador, conteudo: a.conteudo, status: a.status, comentario: a.comentario ?? null, autorId: U[a.revisor], createdAt: d(doc.quando) };
        await prisma.unidadeRevisao.upsert({ where: { id }, update: dados, create: { id, ...dados } });
      }
    } else if (doc.modo === "SECOES") {
      const idInteiro = `${doc.id}-u-inteiro`;
      const dadosInteiro = { documentoId: doc.id, tipo: "DOCUMENTO_INTEIRO", identificador: "documento_inteiro", status: doc.inteiro.status, comentario: doc.inteiro.comentario ?? null, autorId: U[doc.inteiro.revisor], createdAt: d(doc.quando) };
      await prisma.unidadeRevisao.upsert({ where: { id: idInteiro }, update: dadosInteiro, create: { id: idInteiro, ...dadosInteiro } });

      for (const [i, s] of doc.secoes.entries()) {
        const secaoId = `${doc.id}-s${i}`;
        const dadosSecao = { documentoId: doc.id, ordem: i, titulo: s.titulo, conteudo: s.conteudo, createdAt: d(doc.quando) };
        await prisma.secaoDocumento.upsert({ where: { id: secaoId }, update: dadosSecao, create: { id: secaoId, ...dadosSecao } });

        const posicionados = s.comentarios.map((c) => {
          const inicio = s.conteudo.indexOf(c.trecho);
          if (inicio === -1) throw new Error(`Trecho não encontrado na seção "${s.titulo}": ${c.trecho}`);
          return { c, inicio, fim: inicio + c.trecho.length };
        }).sort((a, b) => a.inicio - b.inicio);
        posicionados.forEach((atual, j) => {
          const anterior = posicionados[j - 1];
          if (anterior && atual.inicio < anterior.fim) throw new Error(`Trechos sobrepostos na seção "${s.titulo}"`);
        });
        for (const [j, p] of posicionados.entries()) {
          const cid = `${secaoId}-c${j}`;
          const dadosCom = { secaoId, trechoInicio: p.inicio, trechoFim: p.fim, trechoTexto: p.c.trecho, comentario: p.c.texto, resolvido: p.c.resolvido, autorId: U[p.c.autor], createdAt: d(p.c.quando) };
          await prisma.comentarioDocumento.upsert({ where: { id: cid }, update: dadosCom, create: { id: cid, ...dadosCom } });
        }
      }
    } else {
      await prisma.unidadeRevisao.update({ where: { id: doc.inteiro.unidadeId }, data: { status: doc.inteiro.status, comentario: doc.inteiro.comentario ?? null, autorId: U.marina, createdAt: d(doc.quando) } });
      await prisma.secaoDocumento.updateMany({ where: { documentoId: doc.id }, data: { createdAt: d(doc.quando) } });
      await prisma.comentarioDocumento.updateMany({ where: { secao: { documentoId: doc.id } }, data: { resolvido: true, createdAt: d(doc.comentariosQuando) } });
    }
  }
}

// ───────────────────────────── memorandos ─────────────────────────────

type MemoSpec = {
  id: string; codigo: string; criador: Usuario; setores: string[]; ac?: Usuario; assunto: string; corpo: string; status: "ABERTO" | "EM_EXECUCAO" | "CONCLUIDO" | "CANCELADO"; quando: string;
  modelo?: { id: string; valores: Record<string, string> }; anexo?: { nome: string; titulo: string; paragrafos: string[] }; assinatura?: { user: Usuario; status: "ASSINADO" | "PENDENTE"; quando?: string }[];
};

const MEMOS: MemoSpec[] = [
  { id: "memo-demo-2", codigo: "MEM-000002", criador: "bruno", setores: ["Administrativo"], ac: "diego", assunto: "Solicitação de veículo para visita técnica a Mariópolis", corpo: "Solicito a reserva de veículo para o deslocamento de duas pessoas da equipe técnica à Prefeitura de Mariópolis, conforme a agenda do projeto PRJ-2026-031 (coleta de documentos e reunião com o RH e a assessoria jurídica).", status: "EM_EXECUCAO", quando: "2026-09-17T10:15:00-03:00", modelo: { id: "modelo-solicitacao-carro", valores: { data: "2026-09-24", horario: "06:30", destino: "Mariópolis — PR (Prefeitura Municipal)", motivo: "Reunião de alinhamento sobre o Estatuto e PCCS e coleta de documentos no local." } } },
  { id: "memo-demo-3", codigo: "MEM-000003", criador: "ana", setores: ["Administrativo"], ac: "diego", assunto: "Reserva de sala para oficina de validação do zoneamento", corpo: "Solicito a reserva da sala de reuniões maior para a reunião de validação do zoneamento do Plano Diretor de Guarapuava, com previsão de 14 participantes e projetor.", status: "ABERTO", quando: "2026-09-18T14:30:00-03:00", modelo: { id: "cmu4pqgrq0007qv8gkipqhhd6", valores: {} } },
  { id: "memo-demo-4", codigo: "MEM-000004", criador: "carla", setores: ["Técnico"], ac: "ana", assunto: "Parecer jurídico sobre a minuta de contrato de Palmas", corpo: "Encaminho o parecer jurídico sobre a minuta do contrato de revisão do Plano Diretor de Palmas (CTR-2026-029). Recomendo a inclusão da cláusula de reajuste pelo IPCA e a revisão do prazo de pagamento previsto na cláusula terceira. Solicito ciência e assinatura para registro.", status: "ABERTO", quando: "2026-09-16T16:40:00-03:00",
    assinatura: [{ user: "carla", status: "ASSINADO", quando: "2026-09-16T16:41:00-03:00" }, { user: "ana", status: "PENDENTE" }], anexo: { nome: "Parecer_Juridico_Minuta_Palmas.pdf", titulo: "Parecer jurídico — minuta do contrato CTR-2026-029", paragrafos: ["Ementa: análise da minuta do contrato de revisão do Plano Diretor de Palmas.", "1. A minuta observa a Lei nº 14.133/2021 quanto ao objeto, prazos e critérios de medição.", "2. Recomenda-se incluir a cláusula de reajuste anual pelo IPCA, hoje ausente.", "3. O prazo de pagamento de 45 dias contraria a política financeira do CTP (30 dias); ajustar.", "Conclusão: favorável à assinatura, condicionada aos ajustes acima."] } },
  { id: "memo-demo-5", codigo: "MEM-000005", criador: "bruno", setores: ["Administrativo"], ac: "diego", assunto: "Aquisição de licenças de software de georreferenciamento", corpo: "Solicito a aquisição de 3 licenças anuais de software de georreferenciamento (SIG), necessárias para o mapeamento dos projetos de Plano Diretor e Mobilidade em andamento. Cotação em anexo.", status: "CONCLUIDO", quando: "2026-08-10T09:20:00-03:00",
    assinatura: [{ user: "bruno", status: "ASSINADO", quando: "2026-08-10T09:22:00-03:00" }, { user: "ana", status: "ASSINADO", quando: "2026-08-10T15:05:00-03:00" }, { user: "diego", status: "ASSINADO", quando: "2026-08-11T10:30:00-03:00" }], anexo: { nome: "Cotacao_Licencas_SIG.pdf", titulo: "Cotação — licenças de software SIG (3 usuários, 12 meses)", paragrafos: ["Fornecedor A: R$ 14.850,00 (3 licenças, suporte 8x5).", "Fornecedor B: R$ 16.200,00 (3 licenças, suporte 24x7).", "Fornecedor C: R$ 13.980,00 (3 licenças, sem treinamento).", "Recomendação da área técnica: Fornecedor A, pelo melhor equilíbrio entre preço e suporte."] } },
  { id: "memo-demo-6", codigo: "MEM-000006", criador: "bruno", setores: ["Jurídico"], assunto: "Relatório da visita técnica a Pato Branco", corpo: "Encaminho para conhecimento o relatório da visita técnica realizada em Pato Branco nos dias 19 e 20/08, com o registro das oficinas participativas e dos pontos críticos de uso do solo identificados.", status: "CONCLUIDO", quando: "2026-08-24T11:00:00-03:00", anexo: { nome: "Relatorio_Visita_Tecnica_Pato_Branco.pdf", titulo: "Relatório de visita técnica — Pato Branco", paragrafos: ["Período: 19 e 20 de agosto de 2026. Equipe: 3 técnicos do CTP.", "Atividades: reunião com a Diretoria de Planejamento, vistoria em 12 pontos de uso do solo conflitante e oficina participativa com 86 participantes.", "Principais achados: ocupação de faixas de várzea do Rio Ligeiro e conflitos entre uso industrial e residencial no entorno da PR-493.", "Encaminhamentos: incorporar os achados ao diagnóstico da Fase 01 e notificar a Procuradoria sobre os pontos sensíveis."] } },
  { id: "memo-demo-7", codigo: "MEM-000007", criador: "ana", setores: ["Administrativo"], ac: "diego", assunto: "Reserva de hospedagem para a equipe técnica — audiência pública", corpo: "Solicito a reserva de 4 diárias de hospedagem para 3 integrantes da equipe técnica, para a audiência pública do Plano Diretor de Guarapuava em 12/11/2026, com check-in no dia 11.", status: "EM_EXECUCAO", quando: "2026-09-18T09:00:00-03:00" },
  { id: "memo-demo-8", codigo: "MEM-000008", criador: "ana", setores: ["Jurídico"], ac: "carla", assunto: "Atualização do modelo de contrato conforme a Lei nº 14.133/2021", corpo: "Solicito a atualização do modelo padrão de contrato e termo de referência do CTP para refletir as regras de gestão e fiscalização da Lei nº 14.133/2021, incluindo cláusulas de matriz de risco e reajuste. Peço a assinatura dos responsáveis para formalizar a demanda.", status: "ABERTO", quando: "2026-09-19T08:45:00-03:00",
    assinatura: [{ user: "ana", status: "ASSINADO", quando: "2026-09-19T08:46:00-03:00" }, { user: "bruno", status: "PENDENTE" }, { user: "carla", status: "PENDENTE" }] },
  { id: "memo-demo-9", codigo: "MEM-000009", criador: "ana", setores: ["Comunicação"], assunto: "Divulgação da audiência pública do Plano Diretor de Guarapuava", corpo: "Solicito o apoio da Comunicação para a divulgação da audiência pública de 12/11/2026: arte para redes sociais, release para imprensa local e convite institucional às entidades.", status: "ABERTO", quando: "2026-09-21T07:50:00-03:00" },
  { id: "memo-demo-10", codigo: "MEM-000010", criador: "diego", setores: ["Técnico"], assunto: "Reserva de auditório para oficina (remarcada)", corpo: "A reserva do auditório para a oficina de 03/09 foi cancelada porque a atividade será realizada nas dependências da Prefeitura de Pato Branco.", status: "CANCELADO", quando: "2026-08-28T13:10:00-03:00" },
];

async function semearMemorandos() {
  // Modelo criado originalmente pela tela de Cadastros; garantido aqui para o seed funcionar num banco novo.
  await prisma.modeloFormulario.upsert({
    where: { id: "cmu4pqgrq0007qv8gkipqhhd6" },
    update: {},
    create: {
      id: "cmu4pqgrq0007qv8gkipqhhd6",
      nome: "Solicitação de sala de reunião",
      tipo: "MEMORANDO",
      campos: JSON.stringify([{ chave: "data_reuniao", label: "Data da reunião", tipo: "date", obrigatorio: true }]),
    },
  });
  // Setores citados pelos memorandos (alguns, como "Comunicação", não vêm do seed base).
  for (const nome of new Set(MEMOS.flatMap((m) => m.setores))) {
    await prisma.setor.upsert({ where: { nome }, update: {}, create: { nome } });
  }
  const setores = Object.fromEntries((await prisma.setor.findMany()).map((s) => [s.nome, s.id]));
  for (const m of MEMOS) {
    let camposModelo: string | null = null;
    if (m.modelo) {
      const modelo = await prisma.modeloFormulario.findUnique({ where: { id: m.modelo.id } });
      const valores = { ...m.modelo.valores };
      if (modelo && Object.keys(valores).length === 0) {
        for (const campo of JSON.parse(modelo.campos) as { chave: string; tipo: string }[]) valores[campo.chave] = campo.tipo === "date" ? "2026-09-29" : "—";
      }
      camposModelo = JSON.stringify(valores);
    }
    const dados = { assunto: m.assunto, corpo: m.corpo, status: m.status, criadoPorId: U[m.criador], acUserId: m.ac ? U[m.ac] : null, modeloId: m.modelo?.id ?? null, camposModelo, createdAt: d(m.quando) };
    await prisma.memorando.upsert({ where: { id: m.id }, update: dados, create: { id: m.id, codigo: m.codigo, ...dados } });
    await prisma.memorandoSetor.deleteMany({ where: { memorandoId: m.id } });
    await prisma.memorandoSetor.createMany({ data: m.setores.map((s) => ({ memorandoId: m.id, setorId: setores[s] })) });

    if (m.anexo) {
      await anexo(`anexo-${m.id}`, m.anexo.nome, [{ estilo: "titulo", texto: m.anexo.titulo }, ...m.anexo.paragrafos.map((texto): Bloco => ({ estilo: "texto", texto }))], m.quando, { memorandoId: m.id });
    }
    if (m.assinatura) {
      const concluido = m.assinatura.every((s) => s.status === "ASSINADO");
      const fluxo = await prisma.fluxoAssinatura.upsert({ where: { memorandoId: m.id }, update: { concluido }, create: { memorandoId: m.id, concluido, createdAt: d(m.quando) } });
      for (const [i, s] of m.assinatura.entries()) {
        const id = `sig-${m.id}-${i}`;
        const dadosSig = { fluxoId: fluxo.id, userId: U[s.user], nomeExterno: null, tipo: "INTERNO", status: s.status, assinadoEm: s.quando ? d(s.quando) : null, ipAssinatura: s.quando ? "189.44.12.31" : null, provider: "local" };
        await prisma.signatario.upsert({ where: { id }, update: dadosSig, create: { id, ...dadosSig } });
      }
    }
  }
}

// ───────────────────────────── notificações e histórico de atividades ─────────────────────────────

type NotifSpec = { user: Usuario; tipo: string; mensagem: string; entidadeTipo: string; entidadeId: string; lida: boolean; quando: string };
const NOTIFS: NotifSpec[] = [
  { user: "ana", tipo: "MUNICIPIO_RESPONDEU", mensagem: 'O município comentou um trecho na seção "Zoneamento urbano proposto" da etapa "Fase 01".', entidadeTipo: "EtapaProjeto", entidadeId: "etapa-pd-fase1-demo", lida: false, quando: "2026-09-18T14:52:00-03:00" },
  { user: "ana", tipo: "MUNICIPIO_RESPONDEU", mensagem: 'O município reprovou "Art. 14 — Do adicional por titulação" na etapa "Minutas versão 01".', entidadeTipo: "EtapaProjeto", entidadeId: "etapa-minuta-demo", lida: false, quando: "2026-09-16T13:04:00-03:00" },
  { user: "ana", tipo: "MUNICIPIO_RESPONDEU", mensagem: 'O município enviou o documento "Folha de pagamento — últimos 12 meses" na etapa "Documentos iniciais".', entidadeTipo: "EtapaProjeto", entidadeId: "etapa-mar-docs", lida: true, quando: "2026-09-15T09:52:00-03:00" },
  { user: "bruno", tipo: "MUNICIPIO_RESPONDEU", mensagem: 'O município comentou um trecho na seção "Uso e ocupação do solo atual" da etapa "Fase 01".', entidadeTipo: "EtapaProjeto", entidadeId: "etapa-pb-fase1", lida: false, quando: "2026-09-16T11:41:00-03:00" },
  { user: "bruno", tipo: "MUNICIPIO_RESPONDEU", mensagem: 'O município comentou um trecho na seção "Mobilidade ativa" da etapa "Diagnóstico de mobilidade".', entidadeTipo: "EtapaProjeto", entidadeId: "cmu4ut0jr0018hby3if7urgkn", lida: false, quando: "2026-09-20T09:41:00-03:00" },
  { user: "bruno", tipo: "MUNICIPIO_RESPONDEU", mensagem: 'O município respondeu o formulário da etapa "Documentos iniciais".', entidadeTipo: "EtapaProjeto", entidadeId: "etapa-cv-docs", lida: true, quando: "2026-08-21T16:13:00-03:00" },
  { user: "marina", tipo: "ETAPA_AGUARDANDO_VOCE", mensagem: 'A etapa "Fase 01" do projeto PRJ-2026-021 está aguardando sua resposta.', entidadeTipo: "EtapaProjeto", entidadeId: "etapa-pd-fase1-demo", lida: false, quando: "2026-09-17T18:01:00-03:00" },
  { user: "marina", tipo: "ETAPA_AGUARDANDO_VOCE", mensagem: 'A etapa "Minutas versão 01" do projeto PRJ-2026-014 está aguardando sua resposta.', entidadeTipo: "EtapaProjeto", entidadeId: "etapa-minuta-demo", lida: true, quando: "2026-09-11T15:05:00-03:00" },
  { user: "marina", tipo: "ETAPA_AGUARDANDO_VOCE", mensagem: 'A etapa "Diagnóstico de mobilidade" do projeto PRJ-2026-025 está aguardando sua resposta.', entidadeTipo: "EtapaProjeto", entidadeId: "cmu4ut0jr0018hby3if7urgkn", lida: false, quando: "2026-09-15T10:01:00-03:00" },
  { user: "juliana", tipo: "ETAPA_AGUARDANDO_VOCE", mensagem: 'A etapa "Fase 01" do projeto PRJ-2026-032 está aguardando sua resposta.', entidadeTipo: "EtapaProjeto", entidadeId: "etapa-pb-fase1", lida: false, quando: "2026-09-14T16:01:00-03:00" },
  { user: "ricardo", tipo: "ETAPA_AGUARDANDO_VOCE", mensagem: 'A etapa "Fase 01" do projeto PRJ-2026-032 está aguardando sua resposta.', entidadeTipo: "EtapaProjeto", entidadeId: "etapa-pb-fase1", lida: true, quando: "2026-09-14T16:01:00-03:00" },
  { user: "helena", tipo: "ETAPA_AGUARDANDO_VOCE", mensagem: 'A etapa "Documentos iniciais" do projeto PRJ-2026-031 está aguardando sua resposta.', entidadeTipo: "EtapaProjeto", entidadeId: "etapa-mar-docs", lida: false, quando: "2026-09-19T16:31:00-03:00" },
  { user: "tatiane", tipo: "ETAPA_AGUARDANDO_VOCE", mensagem: 'A etapa "Documentos iniciais" do projeto PRJ-2026-033 está aguardando sua resposta.', entidadeTipo: "EtapaProjeto", entidadeId: "etapa-cv-docs", lida: true, quando: "2026-08-10T10:01:00-03:00" },
];

type AuditSpec = { user: Usuario; acao: string; entidadeTipo: string; entidadeId: string; detalhe?: string; quando: string };
const AUDITS: AuditSpec[] = [
  { user: "ana", acao: "CRIAR", entidadeTipo: "Memorando", entidadeId: "memo-demo-9", quando: "2026-09-21T07:50:00-03:00" },
  { user: "bruno", acao: "APROVAR_CHECKLIST", entidadeTipo: "ChecklistItem", entidadeId: "check-mar-lei", quando: "2026-09-21T08:15:00-03:00" },
  { user: "ana", acao: "RESOLVER_COMENTARIO", entidadeTipo: "ComentarioDocumento", entidadeId: "documento-pd-guarapuava-v2-s5-c1", quando: "2026-09-20T16:41:00-03:00" },
  { user: "marina", acao: "COMENTAR_TRECHO", entidadeTipo: "SecaoDocumento", entidadeId: "documento-pd-guarapuava-v2-s5", detalhe: "1.240 nascentes", quando: "2026-09-20T10:05:00-03:00" },
  { user: "ana", acao: "CRIAR", entidadeTipo: "Contrato", entidadeId: "contrato-demo-coronel-vivida-pd", quando: "2026-09-19T11:00:00-03:00" },
  { user: "bruno", acao: "RESOLVER_COMENTARIO", entidadeTipo: "ComentarioDocumento", entidadeId: "documento-pd-guarapuava-v2-s0-c1", quando: "2026-09-19T09:31:00-03:00" },
  { user: "carla", acao: "ASSINAR", entidadeTipo: "Contrato", entidadeId: "contrato-demo-palmas-pd", quando: "2026-09-18T09:20:00-03:00" },
  { user: "ana", acao: "ASSINAR", entidadeTipo: "Contrato", entidadeId: "contrato-demo-palmas-pd", quando: "2026-09-18T09:15:00-03:00" },
  { user: "marina", acao: "COMENTAR_TRECHO", entidadeTipo: "SecaoDocumento", entidadeId: "documento-pd-guarapuava-v2-s2", detalhe: "coeficiente de aproveitamento básico", quando: "2026-09-18T14:40:00-03:00" },
  { user: "bruno", acao: "ENVIAR_MINUTA", entidadeTipo: "EtapaProjeto", entidadeId: "etapa-pd-fase1-demo", detalhe: "v2", quando: "2026-09-17T17:58:00-03:00" },
  { user: "marina", acao: "REVISAR_REPROVADO", entidadeTipo: "UnidadeRevisao", entidadeId: "unidade-demo-7", detalhe: "Art. 14", quando: "2026-09-16T13:04:00-03:00" },
  { user: "juliana", acao: "COMENTAR_TRECHO", entidadeTipo: "SecaoDocumento", entidadeId: "documento-pd-patobranco-v1-s0", detalhe: "população estimada", quando: "2026-09-16T10:10:00-03:00" },
  { user: "helena", acao: "ENVIAR_CHECKLIST", entidadeTipo: "ChecklistItem", entidadeId: "check-mar-folha", quando: "2026-09-15T09:51:00-03:00" },
  { user: "bruno", acao: "ENVIAR_MINUTA", entidadeTipo: "EtapaProjeto", entidadeId: "cmu4ut0jr0018hby3if7urgkn", detalhe: "v1", quando: "2026-09-15T09:35:00-03:00" },
  { user: "ana", acao: "MUDAR_STATUS_ETAPA", entidadeTipo: "EtapaProjeto", entidadeId: "etapa-pb-fase1", detalhe: "AGUARDANDO_MUNICIPIO", quando: "2026-09-14T16:00:00-03:00" },
  { user: "ana", acao: "AVANCAR_ETAPA", entidadeTipo: "Contrato", entidadeId: "contrato-demo-pato-branco-estatuto", detalhe: "APROVACAO_ORCAMENTO", quando: "2026-09-10T14:20:00-03:00" },
  { user: "carla", acao: "ENVIAR_MINUTA", entidadeTipo: "EtapaProjeto", entidadeId: "etapa-minuta-demo", detalhe: "v3", quando: "2026-09-11T15:02:00-03:00" },
  { user: "ana", acao: "CRIAR_PROJETO", entidadeTipo: "Contrato", entidadeId: "contrato-demo-mariopolis-pccs", detalhe: "PRJ-2026-031", quando: "2026-07-27T09:00:00-03:00" },
];

async function semearNotificacoesEAuditoria() {
  for (const [i, n] of NOTIFS.entries()) {
    const id = `notif-demo-${i + 1}`;
    const dados = { userId: U[n.user], tipo: n.tipo, mensagem: n.mensagem, entidadeTipo: n.entidadeTipo, entidadeId: n.entidadeId, lida: n.lida, createdAt: d(n.quando) };
    await prisma.notificacao.upsert({ where: { id }, update: dados, create: { id, ...dados } });
  }
  for (const [i, a] of AUDITS.entries()) {
    const id = `audit-demo2-${i + 1}`;
    const dados = { userId: U[a.user], acao: a.acao, entidadeTipo: a.entidadeTipo, entidadeId: a.entidadeId, detalhe: a.detalhe ?? null, createdAt: d(a.quando) };
    await prisma.auditLog.upsert({ where: { id }, update: dados, create: { id, ...dados } });
  }
}

/** Remove os anexos-fantasma (caminho "/file.svg") do seed antigo, agora substituídos por PDFs reais. */
async function limparAnexosLegados() {
  await prisma.anexo.deleteMany({ where: { id: { in: ["anexo-minuta-demo", "anexo-plano-diretor-demo"] }, documentoVersao: null } });
}

async function main() {
  await semearPessoas();
  await semearContratos();
  await semearProjetos();
  await semearConversas();
  await semearDocumentos();
  await limparAnexosLegados();
  // Documentos das etapas abrem no editor (texto + grifos/comentários como anotações).
  const editor = await migrarDocumentosParaEditor(prisma);
  await semearRespostasDemo(prisma);
  console.log("Documentos convertidos para o editor:", editor);
  await semearMemorandos();
  await semearNotificacoesEAuditoria();

  const [contratos, projetos, memorandos, documentos, comentarios, mensagens, anexos, usuarios] = await Promise.all([
    prisma.contrato.count(), prisma.projeto.count(), prisma.memorando.count(), prisma.documentoVersionado.count(),
    prisma.comentarioDocumento.count(), prisma.mensagemChat.count(), prisma.anexo.count(), prisma.user.count(),
  ]);
  console.log("Seed de demonstração concluído.", { usuarios, contratos, projetos, memorandos, documentos, comentarios, mensagens, anexos });
  console.log("Logins do município (senha ctpwork123): marina.kowalski@guarapuava.pr.gov.br, helena.bittencourt@mariopolis.pr.gov.br, juliana.menegatti@patobranco.pr.gov.br, tatiane.wolff@coronelvivida.pr.gov.br");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
