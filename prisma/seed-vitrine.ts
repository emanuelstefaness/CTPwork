import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
    permissoes: ["minuta.revisar", "minuta.parecer", "contrato.assinar", "etapa.enviar"],
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

type EtapaSpec = { chave: string; nome: string; curto: string; assinaturas?: boolean; projeto?: boolean; soGestor?: boolean };

const FLUXOS: { id: string; nome: string; descricao: string; municipioId?: string; etapas: EtapaSpec[] }[] = [
  {
    id: "fluxo-dispensa",
    nome: "Dispensa de licitação",
    descricao: "Contratação direta (Lei 14.133/2021, art. 75), com parecer jurídico antes da assinatura.",
    etapas: [
      { chave: "SOLICITACAO", nome: "Solicitação da prefeitura", curto: "Solicitação" },
      { chave: "PROPOSTA", nome: "Proposta técnica e comercial", curto: "Proposta" },
      { chave: "PARECER_JURIDICO", nome: "Justificativa e parecer jurídico", curto: "Parecer", soGestor: true },
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
      perfisQueAvancam: e.perfisQueAvancam, concluidaEm: feito ? d(feito.em) : null, concluidaPorId: feito ? feito.por : null,
    };
    await prisma.etapaContrato.upsert({
      where: { contratoId_chave: { contratoId: c.id, chave: e.chave } },
      update: etapa,
      create: { contratoId: c.id, chave: e.chave, ...etapa },
    });
  }
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
    etapas: padrao.map((e) => ({ chave: e.chave, nome: e.nome, curto: e.curto, assinaturas: e.exigeAssinaturas, projeto: e.liberaProjeto })),
  });
  const planoDiretor = await prisma.tipoProjetoModelo.findUnique({ where: { chave: "PLANO_DIRETOR" }, include: { etapas: { orderBy: { ordem: "asc" } } } });
  if (planoDiretor && !(await prisma.tipoProjetoModelo.findUnique({ where: { chave: "PLANO_DIRETOR_CLEVELANDIA" } }))) {
    await prisma.tipoProjetoModelo.create({
      data: {
        chave: "PLANO_DIRETOR_CLEVELANDIA",
        nome: "Plano Diretor — Clevelândia",
        municipioId: CLEVELANDIA,
        etapas: {
          create: planoDiretor.etapas.map(({ ordem, nome, temInformacoesProjeto, temFormulario, temChecklist, temRevisao, modoRevisao }) => ({ ordem, nome, temInformacoesProjeto, temFormulario, temChecklist, temRevisao, modoRevisao })),
        },
      },
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
    concluidas: [
      { por: ana.id, em: "2026-09-15T16:20:00-03:00" },
      { por: bruno.id, em: "2026-09-22T11:05:00-03:00" },
      { por: ana.id, em: "2026-09-29T09:40:00-03:00" },
    ],
    tags: ["Plano Diretor"],
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

  // Avisos no sino de quem pode destravar as etapas restritas ao Gestor.
  const avisos = [
    { id: "notif-vitrine-dispensa", mensagem: "CTR-2026-035 aguarda o parecer jurídico — etapa restrita ao perfil Gestor.", entidadeId: "contrato-vitrine-dispensa", quando: "2026-09-26T17:45:00-03:00" },
    { id: "notif-vitrine-aditivo", mensagem: "CTR-2026-036 (aditivo de Guarapuava) aguarda aprovação da diretoria.", entidadeId: "contrato-vitrine-aditivo", quando: "2026-10-01T15:00:00-03:00" },
  ];
  for (const a of avisos) {
    // emailStatus IGNORADO: dado de demonstração, não deve virar e-mail.
    const dados = { userId: ana.id, tipo: "CONTRATO", mensagem: a.mensagem, entidadeTipo: "Contrato", entidadeId: a.entidadeId, lida: false, emailStatus: "IGNORADO", createdAt: d(a.quando) };
    await prisma.notificacao.upsert({ where: { id: a.id }, update: dados, create: { id: a.id, ...dados } });
  }

  console.log("Vitrine pronta: 3 perfis, 3 tipos de contrato (1 exclusivo), Prefeitura de Clevelândia com 2 acessos, 3 contratos e 3 conversas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
