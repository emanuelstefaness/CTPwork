import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { gravarPdf, type Bloco } from "./demo/pdf";
import { semearRevisaoDaMinuta } from "./demo/processo";

// Seed de VITRINE: mostra as funções de personalização sobre o cenário de demonstração —
// perfis próprios, tipos de contrato (Dispensa, Termo aditivo), uma prefeitura com fluxos
// exclusivos e acessos, contratos parados em etapas restritas e conversas. Idempotente (ids fixos
// + upsert) e não apaga nada. Pré-requisito: `npm run seed` e `npm run seed:demo`.
//   npm run seed:vitrine

const prisma = new PrismaClient();
const d = (iso: string) => new Date(iso);
const SENHA_DEMO = "ctpwork123";

async function usuarioPorEmail(email: string) {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) throw new Error(`Usuário ${email} não existe — rode antes npm run seed e npm run seed:demo.`);
  return u;
}

// ───────────────────────────── perfis ─────────────────────────────

const PERFIS = [
  {
    id: "perfil-juridico",
    nome: "Jurídico",
    descricao: "Escreve e revisa minutas; vê só os contratos e projetos em que participa.",
    tipo: "INTERNO",
    permissoes: ["minuta.escrever"],
    somenteParticipa: true,
  },
  {
    id: "perfil-prefeito",
    nome: "Prefeito",
    descricao: "Revisa, dá o parecer e assina os contratos pela prefeitura.",
    tipo: "EXTERNO",
    permissoes: ["minuta.revisar", "minuta.parecer", "contrato.assinar", "contrato.aprovar", "etapa.enviar"],
    somenteParticipa: false,
  },
  {
    id: "perfil-servidor-tecnico",
    nome: "Servidor técnico",
    descricao: "Envia documentos e comenta as minutas, sem dar o parecer nem assinar.",
    tipo: "EXTERNO",
    permissoes: ["minuta.revisar", "etapa.enviar"],
    somenteParticipa: false,
  },
];

// ───────────────────────────── tipos de contrato ─────────────────────────────

type EnviaQuem = "PREFEITURA" | "CTP";
type Entrega = { status: "ENVIADO" | "APROVADO"; quando: string } | { status: "RECUSADO"; motivo: string; quando: string };
type EtapaSpec = {
  chave: string; nome: string; curto: string; assinaturas?: boolean; projeto?: boolean; soGestor?: boolean;
  /** Etapa decidida pela prefeitura (ex.: aprovação). */
  prefeitura?: boolean;
  /** Documentos pedidos por padrão: [nome, quem envia]. */
  docs?: [string, EnviaQuem][];
};

const FLUXOS: { id: string; nome: string; descricao: string; municipioId?: string; etapas: EtapaSpec[] }[] = [
  {
    id: "fluxo-dispensa",
    nome: "Dispensa de licitação",
    descricao: "Contratação direta (Lei 14.133/2021, art. 75), com parecer jurídico antes da assinatura.",
    etapas: [
      { chave: "SOLICITACAO", nome: "Solicitação da prefeitura", curto: "Solicitação", docs: [["Ofício de solicitação", "PREFEITURA"]] },
      { chave: "PROPOSTA", nome: "Proposta técnica e comercial", curto: "Proposta", docs: [["Proposta técnica e comercial", "CTP"]] },
      { chave: "PARECER_JURIDICO", nome: "Justificativa e parecer jurídico", curto: "Parecer", soGestor: true, docs: [["Justificativa da contratação direta", "CTP"], ["Parecer jurídico da procuradoria", "PREFEITURA"]] },
      { chave: "ASSINATURA", nome: "Assinatura do contrato", curto: "Assinatura", assinaturas: true },
      { chave: "VIGENTE", nome: "Contrato vigente", curto: "Vigente", projeto: true },
    ],
  },
  {
    id: "fluxo-aditivo",
    nome: "Termo aditivo",
    descricao: "Prorrogação de prazo ou ajuste de escopo de um contrato existente. Não gera projeto novo.",
    etapas: [
      { chave: "PEDIDO_ADITIVO", nome: "Pedido de aditivo", curto: "Pedido" },
      { chave: "APROVACAO_DIRETORIA", nome: "Aprovação da diretoria", curto: "Diretoria", soGestor: true },
      { chave: "ADITIVO_FIRMADO", nome: "Aditivo firmado", curto: "Firmado" },
    ],
  },
];

async function semearFluxo(f: (typeof FLUXOS)[number]) {
  await prisma.fluxoContrato.upsert({
    where: { id: f.id },
    update: { nome: f.nome, descricao: f.descricao, municipioId: f.municipioId ?? null, ativo: true },
    create: { id: f.id, nome: f.nome, descricao: f.descricao, municipioId: f.municipioId ?? null },
  });
  for (const [ordem, e] of f.etapas.entries()) {
    const dados = {
      ordem,
      nome: e.nome,
      curto: e.curto,
      exigeAssinaturas: !!e.assinaturas,
      liberaProjeto: !!e.projeto,
      perfisQueAvancam: JSON.stringify(e.soGestor ? ["perfil-gestor"] : []),
      concluidaPelaPrefeitura: !!e.prefeitura,
      documentosPadrao: JSON.stringify((e.docs ?? []).map(([nome, enviaQuem]) => ({ nome, enviaQuem }))),
    };
    await prisma.etapaFluxoContrato.upsert({
      where: { fluxoId_chave: { fluxoId: f.id, chave: e.chave } },
      update: dados,
      create: { fluxoId: f.id, chave: e.chave, ...dados },
    });
  }
}

// ───────────────────────────── contratos ─────────────────────────────

/** Cria o contrato com as etapas do tipo copiadas; as `concluidas` primeiras ficam como concluídas. */
async function semearContrato(c: {
  id: string; codigo: string; objeto: string; contratanteId: string; fluxoId: string;
  responsavelId: string; concluidas: { por: string; em: string }[]; criadoEm: string; tags?: string[];
  /**
   * Situação de documentos da etapa atual (pelo nome); os não listados ficam pendentes. RECUSADO:
   * o arquivo enviado fica no histórico do contrato e o documento volta a ser pedido, com o motivo.
   */
  entregues?: Record<string, Entrega>;
  /** A prefeitura pediu revisão: o contrato voltou para a etapa atual com este motivo. */
  devolucao?: string;
  /** Arquivos antigos que ficam só no histórico (ex.: a 1ª versão do orçamento, substituída). */
  historico?: { id: string; nome: string; quando: string; enviaQuem: EnviaQuem }[];
}) {
  const fluxo = await prisma.fluxoContrato.findUniqueOrThrow({ where: { id: c.fluxoId }, include: { etapas: { orderBy: { ordem: "asc" } } } });
  const atual = fluxo.etapas[c.concluidas.length];
  const dados = {
    codigo: c.codigo,
    objeto: c.objeto,
    contratanteId: c.contratanteId,
    fluxoId: fluxo.id,
    responsavelId: c.responsavelId,
    etapaAtual: atual.chave,
    tags: c.tags ? JSON.stringify(c.tags) : null,
  };
  await prisma.contrato.upsert({ where: { id: c.id }, update: dados, create: { id: c.id, createdAt: d(c.criadoEm), ...dados } });
  for (const e of fluxo.etapas) {
    const feito = c.concluidas[e.ordem];
    const etapa = {
      ordem: e.ordem, nome: e.nome, curto: e.curto, exigeAssinaturas: e.exigeAssinaturas, liberaProjeto: e.liberaProjeto,
      perfisQueAvancam: e.perfisQueAvancam, concluidaPelaPrefeitura: e.concluidaPelaPrefeitura,
      concluidaEm: feito ? d(feito.em) : null, concluidaPorId: feito ? feito.por : null,
      motivoDevolucao: c.devolucao && e.chave === atual.chave ? c.devolucao : null,
    };
    await prisma.etapaContrato.upsert({
      where: { contratoId_chave: { contratoId: c.id, chave: e.chave } },
      update: etapa,
      create: { contratoId: c.id, chave: e.chave, ...etapa },
    });
  }

  // Documentos padrão, como na criação pelo sistema: nas etapas já concluídas, todos entregues e
  // aprovados; na atual, conforme `entregues`; nas seguintes, pendentes.
  for (const e of fluxo.etapas) {
    const docs = JSON.parse(e.documentosPadrao) as { nome: string; enviaQuem: EnviaQuem }[];
    const feito = c.concluidas[e.ordem];
    for (const [i, doc] of docs.entries()) {
      const id = `doc-${c.id}-${e.chave.toLowerCase()}-${i}`;
      const entregue: Entrega | undefined = feito ? { status: "APROVADO", quando: feito.em } : e.chave === atual.chave ? c.entregues?.[doc.nome] : undefined;
      const anexo = entregue ? await anexoPdf(`anexo-${id}`, doc.nome, c, entregue.quando, doc.enviaQuem) : null;
      const recusado = entregue?.status === "RECUSADO";
      const dados = {
        contratoId: c.id, etapaChave: e.chave, nome: doc.nome, enviaQuem: doc.enviaQuem,
        status: !entregue || recusado ? "PENDENTE" : entregue.status,
        anexoId: recusado ? null : anexo, enviadoEm: entregue && !recusado ? d(entregue.quando) : null,
        // Revisão pedida pela prefeitura: o que o CTP entregou na etapa volta a ser pedido, com o motivo.
        motivoRecusa: recusado ? entregue.motivo : !entregue && c.devolucao && e.chave === atual.chave && doc.enviaQuem === "CTP" ? c.devolucao : null,
      };
      await prisma.documentoContrato.upsert({ where: { id }, update: dados, create: { id, ...dados } });
    }
  }
  for (const h of c.historico ?? []) await anexoPdf(h.id, h.nome, c, h.quando, h.enviaQuem);
}

/** PDF simples de demonstração, ligado ao contrato (aparece em "Arquivos do contrato"). */
async function anexoPdf(id: string, nome: string, c: { id: string; codigo: string; objeto: string }, quando: string, enviaQuem: EnviaQuem) {
  const blocos: Bloco[] = [
    { estilo: "titulo", texto: nome },
    { estilo: "subtitulo", texto: c.codigo },
    { estilo: "texto", texto: `Documento referente ao contrato "${c.objeto}".` },
    { estilo: "nota", texto: enviaQuem === "CTP" ? "Emitido pelo Cilla Tech Park." : "Emitido pela prefeitura contratante." },
  ];
  const tamanho = await gravarPdf(id, `CTP Work — Cilla Tech Park  ·  ${nome}`, blocos);
  const dados = { nomeOriginal: `${nome.replace(/[^\p{L}\p{N}]+/gu, "_")}.pdf`, caminho: `/api/files/${id}`, tamanho, tipoMime: "application/pdf", contratoId: c.id, createdAt: d(quando) };
  await prisma.anexo.upsert({ where: { id }, update: dados, create: { id, ...dados } });
  return id;
}

// ───────────────────────────── conversas ─────────────────────────────

type Msg = { autor: string; quando: string; texto: string };

async function semearConversa(c: {
  id: string; municipioId: string; assunto: string; contratoId?: string; status?: "ABERTA" | "ENCERRADA";
  mensagens: Msg[]; lidaPor: string[];
}) {
  const ultima = c.mensagens.at(-1)!;
  const dados = {
    municipioId: c.municipioId, assunto: c.assunto, contratoId: c.contratoId ?? null, criadoPorId: c.mensagens[0].autor,
    status: c.status ?? "ABERTA", ultimaMensagemEm: d(ultima.quando),
  };
  await prisma.conversa.upsert({ where: { id: c.id }, update: dados, create: { id: c.id, createdAt: d(c.mensagens[0].quando), ...dados } });
  for (const [i, m] of c.mensagens.entries()) {
    const id = `${c.id}-m${i + 1}`;
    const msg = { conversaId: c.id, autorId: m.autor, texto: m.texto, createdAt: d(m.quando) };
    await prisma.mensagemConversa.upsert({ where: { id }, update: msg, create: { id, ...msg } });
  }
  // Quem já leu até a última mensagem; os demais veem a conversa como não lida.
  for (const userId of c.lidaPor) {
    await prisma.leituraConversa.upsert({
      where: { conversaId_userId: { conversaId: c.id, userId } },
      update: { lidoEm: d(ultima.quando) },
      create: { conversaId: c.id, userId, lidoEm: d(ultima.quando) },
    });
  }
}

// ───────────────────────────── principal ─────────────────────────────

async function main() {
  const ana = await usuarioPorEmail("gestor@ctp.org.br");
  const bruno = await usuarioPorEmail("colaborador@ctp.org.br");
  const carla = await usuarioPorEmail("juridico@ctp.org.br");
  const helena = await usuarioPorEmail("helena.bittencourt@mariopolis.pr.gov.br");
  const eduardo = await usuarioPorEmail("eduardo.gasparin@palmas.pr.gov.br");

  // Perfis próprios + quem usa cada um.
  for (const p of PERFIS) {
    const dados = { nome: p.nome, descricao: p.descricao, tipo: p.tipo, permissoes: JSON.stringify(p.permissoes), somenteParticipa: p.somenteParticipa };
    await prisma.perfil.upsert({ where: { id: p.id }, update: dados, create: { id: p.id, ...dados } });
  }
  await prisma.user.update({ where: { id: carla.id }, data: { perfilId: "perfil-juridico" } });
  await prisma.user.update({ where: { id: "user-demo-rogerio" }, data: { perfilId: "perfil-servidor-tecnico" } });

  // Tipos de contrato gerais.
  for (const f of FLUXOS) await semearFluxo(f);

  // Prefeitura nova, como sai do assistente "Nova prefeitura".
  const CLEVELANDIA = "municipio-clevelandia";
  const municipio = { nome: "Prefeitura de Clevelândia", contatoNome: "Gabinete do Prefeito", contatoEmail: "gabinete@clevelandia.pr.gov.br", contatoFone: "(46) 3252-1122" };
  await prisma.municipio.upsert({ where: { id: CLEVELANDIA }, update: municipio, create: { id: CLEVELANDIA, ...municipio } });

  const hash = await bcrypt.hash(SENHA_DEMO, 10);
  const ACESSOS = [
    { id: "user-vitrine-carlos", nome: "Carlos Pellizzaro", email: "carlos.pellizzaro@clevelandia.pr.gov.br", perfilId: "perfil-prefeito" },
    { id: "user-vitrine-beatriz", nome: "Beatriz Lorenzetti", email: "beatriz.lorenzetti@clevelandia.pr.gov.br", perfilId: "perfil-servidor-tecnico" },
  ];
  for (const u of ACESSOS) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { nome: u.nome, perfilId: u.perfilId, municipioId: CLEVELANDIA, ativo: true },
      create: { id: u.id, nome: u.nome, email: u.email, passwordHash: hash, tipo: "EXTERNO", municipioId: CLEVELANDIA, perfilId: u.perfilId },
    });
  }

  // Fluxos exclusivos de Clevelândia: cópias do Padrão (contrato) e do Plano Diretor (projeto).
  const padrao = await prisma.etapaFluxoContrato.findMany({ where: { fluxoId: "fluxo-contrato-padrao" }, orderBy: { ordem: "asc" } });
  await semearFluxo({
    id: "fluxo-clevelandia",
    nome: "Padrão — Clevelândia",
    descricao: "Tipo de contrato exclusivo da Prefeitura de Clevelândia.",
    municipioId: CLEVELANDIA,
    etapas: padrao.map((e) => ({
      chave: e.chave, nome: e.nome, curto: e.curto, assinaturas: e.exigeAssinaturas, projeto: e.liberaProjeto, prefeitura: e.concluidaPelaPrefeitura,
      docs: (JSON.parse(e.documentosPadrao) as { nome: string; enviaQuem: EnviaQuem }[]).map((x): [string, EnviaQuem] => [x.nome, x.enviaQuem]),
    })),
  });
  const planoDiretor = await prisma.tipoProjetoModelo.findUnique({ where: { chave: "PLANO_DIRETOR" }, include: { etapas: { orderBy: { ordem: "asc" } } } });
  if (planoDiretor) {
    // Cópia exclusiva sempre igual ao Plano Diretor atual (nenhum projeto usa esse tipo ainda).
    const etapas = planoDiretor.etapas.map(({ ordem, nome, temInformacoesProjeto, temFormulario, temChecklist, temRevisao, modoRevisao, documentosPadrao }) => ({ ordem, nome, temInformacoesProjeto, temFormulario, temChecklist, temRevisao, modoRevisao, documentosPadrao }));
    await prisma.tipoProjetoModelo.upsert({
      where: { chave: "PLANO_DIRETOR_CLEVELANDIA" },
      update: { nome: "Plano Diretor — Clevelândia", municipioId: CLEVELANDIA, etapas: { deleteMany: {}, create: etapas } },
      create: { chave: "PLANO_DIRETOR_CLEVELANDIA", nome: "Plano Diretor — Clevelândia", municipioId: CLEVELANDIA, etapas: { create: etapas } },
    });
  }

  // Contratos que mostram cada tipo em andamento.
  await semearContrato({
    id: "contrato-vitrine-clevelandia",
    codigo: "CTR-2026-034",
    objeto: "Revisão do Plano Diretor Municipal de Clevelândia",
    contratanteId: CLEVELANDIA,
    fluxoId: "fluxo-clevelandia",
    responsavelId: ana.id,
    criadoEm: "2026-09-14T10:00:00-03:00",
    // O orçamento foi e voltou: a 1ª proposta (22/09) teve revisão pedida pelo prefeito (24/09);
    // a 2ª (26/09) foi aprovada por ele (29/09). Ver a conversa "Revisão do orçamento" abaixo.
    concluidas: [
      { por: ana.id, em: "2026-09-15T16:20:00-03:00" },
      { por: bruno.id, em: "2026-09-26T11:05:00-03:00" },
      { por: "user-vitrine-carlos", em: "2026-09-29T09:40:00-03:00" }, // aprovação do orçamento: o prefeito
    ],
    tags: ["Plano Diretor"],
    historico: [
      { id: "anexo-vitrine-clevelandia-orcamento-v1", nome: "Proposta de orçamento — versão 1 (substituída)", quando: "2026-09-22T11:00:00-03:00", enviaQuem: "CTP" },
    ],
    entregues: {
      "Certidões de regularidade fiscal e trabalhista": { status: "APROVADO", quando: "2026-09-30T14:00:00-03:00" },
      "Contrato social e cartão CNPJ": { status: "APROVADO", quando: "2026-09-30T14:05:00-03:00" },
      "Portaria de designação do fiscal do contrato": { status: "APROVADO", quando: "2026-10-01T09:35:00-03:00" },
      "Declaração de dotação orçamentária": {
        status: "RECUSADO", quando: "2026-10-01T09:30:00-03:00",
        motivo: "Falta a assinatura do contador responsável e a indicação da rubrica (3.3.90.39 — Outros serviços de terceiros, PJ). Por favor, reenviem a declaração completa.",
      },
      "Termo de referência assinado": { status: "ENVIADO", quando: "2026-10-02T10:20:00-03:00" },
    },
  });
  // Contrato aguardando o prefeito: ele aprova ou pede revisão ao entrar.
  await semearContrato({
    id: "contrato-vitrine-clevelandia-pccs",
    codigo: "CTR-2026-037",
    objeto: "Elaboração do Estatuto dos Servidores e do PCCS de Clevelândia",
    contratanteId: CLEVELANDIA,
    fluxoId: "fluxo-clevelandia",
    responsavelId: bruno.id,
    criadoEm: "2026-09-29T15:00:00-03:00",
    concluidas: [
      { por: bruno.id, em: "2026-09-30T10:00:00-03:00" },
      { por: bruno.id, em: "2026-10-03T16:40:00-03:00" },
    ],
    tags: ["PCCS"],
  });
  // A prefeitura de Palmas não aprovou o orçamento: o contrato voltou para o CTP refazer.
  await semearContrato({
    id: "contrato-vitrine-palmas-saude",
    codigo: "CTR-2026-038",
    objeto: "Reestruturação do quadro de pessoal da Secretaria de Saúde de Palmas",
    contratanteId: "municipio-palmas",
    fluxoId: "fluxo-contrato-padrao",
    responsavelId: ana.id,
    criadoEm: "2026-09-21T09:30:00-03:00",
    concluidas: [{ por: ana.id, em: "2026-09-22T14:00:00-03:00" }],
    devolucao: "O valor de R$ 186.400,00 ficou acima da dotação reservada (R$ 150.000,00). Pedimos retirar o dimensionamento das unidades de saúde do interior ou dividir o serviço em duas etapas, com a segunda no exercício de 2027.",
    historico: [
      { id: "anexo-vitrine-palmas-saude-orcamento-v1", nome: "Proposta de orçamento — versão 1 (revisão pedida)", quando: "2026-09-29T17:10:00-03:00", enviaQuem: "CTP" },
    ],
    tags: ["Saúde", "Quadro de pessoal"],
  });
  await semearContrato({
    id: "contrato-vitrine-dispensa",
    codigo: "CTR-2026-035",
    objeto: "Capacitação de servidores em gestão de pessoas e avaliação de desempenho",
    contratanteId: "municipio-mariopolis",
    fluxoId: "fluxo-dispensa",
    responsavelId: bruno.id,
    criadoEm: "2026-09-18T14:30:00-03:00",
    concluidas: [
      { por: bruno.id, em: "2026-09-19T10:10:00-03:00" },
      { por: bruno.id, em: "2026-09-26T17:45:00-03:00" },
    ],
    tags: ["Capacitação", "Dispensa"],
  });
  await semearContrato({
    id: "contrato-vitrine-aditivo",
    codigo: "CTR-2026-036",
    objeto: "Aditivo de prazo (+90 dias) — Estatuto e PCCS de Guarapuava",
    contratanteId: "municipio-demo",
    fluxoId: "fluxo-aditivo",
    responsavelId: ana.id,
    criadoEm: "2026-09-30T09:00:00-03:00",
    concluidas: [{ por: ana.id, em: "2026-10-01T15:00:00-03:00" }],
    tags: ["Aditivo"],
  });

  // Conversas fora das etapas.
  await semearConversa({
    id: "conversa-vitrine-clevelandia",
    municipioId: CLEVELANDIA,
    assunto: "Reunião de abertura do Plano Diretor",
    contratoId: "contrato-vitrine-clevelandia",
    mensagens: [
      { autor: "user-vitrine-carlos", quando: "2026-09-30T08:50:00-03:00", texto: "Bom dia! Recebemos o acesso ao sistema. Podemos marcar a reunião de abertura para a próxima semana? Gostaria que o secretário de Planejamento participasse." },
      { autor: ana.id, quando: "2026-09-30T10:15:00-03:00", texto: "Bom dia, prefeito! Sugiro terça, 07/10, às 14h, na Prefeitura. Levamos a pauta e a lista de documentos que vamos pedir na etapa seguinte." },
      { autor: "user-vitrine-carlos", quando: "2026-09-30T11:02:00-03:00", texto: "Confirmado. A Beatriz, da Secretaria de Planejamento, vai acompanhar o envio dos documentos por aqui." },
    ],
    lidaPor: ["user-vitrine-carlos", ana.id],
  });
  await semearConversa({
    id: "conversa-vitrine-dispensa",
    municipioId: "municipio-mariopolis",
    assunto: "Enquadramento da capacitação como dispensa",
    contratoId: "contrato-vitrine-dispensa",
    mensagens: [
      { autor: helena.id, quando: "2026-10-01T09:30:00-03:00", texto: "Olá! O controle interno perguntou em qual inciso do art. 75 a contratação se enquadra. Conseguem indicar na justificativa?" },
      { autor: bruno.id, quando: "2026-10-01T13:12:00-03:00", texto: "Olá, Helena! Será o inciso II (valor). A justificativa está com a nossa coordenação para o parecer jurídico." },
      { autor: helena.id, quando: "2026-10-03T16:40:00-03:00", texto: "Obrigada! Temos sessão da Câmara dia 15 — se o parecer sair até dia 10, conseguimos assinar antes." },
    ],
    lidaPor: [helena.id],
  });
  await semearConversa({
    id: "conversa-vitrine-palmas",
    municipioId: "municipio-palmas",
    assunto: "Cronograma de visitas técnicas",
    status: "ENCERRADA",
    mensagens: [
      { autor: ana.id, quando: "2026-09-10T10:00:00-03:00", texto: "Eduardo, segue a proposta de visitas técnicas: 22/09 (Obras), 24/09 (Saúde) e 29/09 (Educação). Pode confirmar com as secretarias?" },
      { autor: eduardo.id, quando: "2026-09-11T15:20:00-03:00", texto: "Todas confirmadas. Obrigado!" },
    ],
    lidaPor: [ana.id, eduardo.id],
  });

  await semearConversa({
    id: "conversa-vitrine-clevelandia-orcamento",
    municipioId: CLEVELANDIA,
    assunto: "Revisão do orçamento do Plano Diretor",
    contratoId: "contrato-vitrine-clevelandia",
    status: "ENCERRADA",
    mensagens: [
      { autor: "user-vitrine-carlos", quando: "2026-09-24T10:12:00-03:00", texto: "Analisamos a proposta. Pedi revisão no sistema: as 4 oficinas comunitárias presenciais pesam muito no valor. Dá para fazer 2 presenciais e 2 on-line?" },
      { autor: bruno.id, quando: "2026-09-24T14:30:00-03:00", texto: "Dá sim, prefeito. Refazemos com 2 oficinas presenciais (área urbana e zona rural) e 2 on-line. O valor cai de R$ 248.900,00 para R$ 221.300,00." },
      { autor: bruno.id, quando: "2026-09-26T11:06:00-03:00", texto: "Nova proposta enviada no contrato. A versão anterior continua em \"Arquivos do contrato\" para comparação." },
      { autor: "user-vitrine-carlos", quando: "2026-09-29T09:41:00-03:00", texto: "Aprovado. Obrigado pela agilidade!" },
    ],
    lidaPor: ["user-vitrine-carlos", bruno.id, ana.id],
  });
  await semearConversa({
    id: "conversa-vitrine-palmas-saude",
    municipioId: "municipio-palmas",
    assunto: "Orçamento da reestruturação da Saúde",
    contratoId: "contrato-vitrine-palmas-saude",
    mensagens: [
      { autor: eduardo.id, quando: "2026-10-02T16:05:00-03:00", texto: "Ana, devolvi o orçamento pelo sistema com o motivo. A Secretaria de Fazenda só consegue empenhar R$ 150 mil este ano." },
      { autor: ana.id, quando: "2026-10-03T09:20:00-03:00", texto: "Entendido, Eduardo. Vamos propor duas etapas: sede em 2026 e unidades do interior em 2027. Enviamos a nova proposta até quarta." },
    ],
    lidaPor: [eduardo.id, ana.id],
  });

  await semearRevisaoDaMinuta(prisma, { ana: ana.id, bruno: bruno.id, carla: carla.id });

  // Avisos no sino: o que cada um tem para fazer (dados de demonstração, nunca viram e-mail).
  const avisos = [
    { id: "notif-vitrine-dispensa", userId: ana.id, mensagem: "CTR-2026-035 aguarda o parecer jurídico — etapa restrita ao perfil Gestor.", entidadeId: "contrato-vitrine-dispensa", quando: "2026-09-26T17:45:00-03:00" },
    { id: "notif-vitrine-aditivo", userId: ana.id, mensagem: "CTR-2026-036 (aditivo de Guarapuava) aguarda aprovação da diretoria.", entidadeId: "contrato-vitrine-aditivo", quando: "2026-10-01T15:00:00-03:00" },
    { id: "notif-vitrine-palmas-revisao", userId: ana.id, mensagem: 'A prefeitura pediu revisão em "Aprovação do orçamento" (contrato CTR-2026-038): o valor ficou acima da dotação reservada.', entidadeId: "contrato-vitrine-palmas-saude", quando: "2026-10-02T16:01:00-03:00" },
    { id: "notif-vitrine-clev-termo", userId: ana.id, mensagem: 'O município enviou "Termo de referência assinado" no contrato CTR-2026-034.', entidadeId: "contrato-vitrine-clevelandia", quando: "2026-10-02T10:21:00-03:00" },
    { id: "notif-vitrine-clev-dotacao", userId: "user-vitrine-beatriz", mensagem: 'O CTP pediu um novo envio de "Declaração de dotação orçamentária" (contrato CTR-2026-034): falta a assinatura do contador e a rubrica.', entidadeId: "contrato-vitrine-clevelandia", quando: "2026-10-01T15:12:00-03:00" },
    { id: "notif-vitrine-clev-pccs", userId: "user-vitrine-carlos", mensagem: 'O contrato CTR-2026-037 (Estatuto e PCCS) aguarda sua aprovação do orçamento.', entidadeId: "contrato-vitrine-clevelandia-pccs", quando: "2026-10-03T16:41:00-03:00" },
  ];
  for (const a of avisos) {
    const dados = { userId: a.userId, tipo: "CONTRATO", mensagem: a.mensagem, entidadeTipo: "Contrato", entidadeId: a.entidadeId, lida: false, emailStatus: "IGNORADO", createdAt: d(a.quando) };
    await prisma.notificacao.upsert({ where: { id: a.id }, update: dados, create: { id: a.id, ...dados } });
  }

  console.log("Vitrine pronta: 3 perfis, 3 tipos de contrato (1 exclusivo), Prefeitura de Clevelândia com 2 acessos, 5 contratos com idas e vindas, 5 conversas e a revisão da minuta de Guarapuava.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
