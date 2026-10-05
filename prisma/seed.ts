import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { semearConfiguracaoBase } from "./base";

const prisma = new PrismaClient();

async function main() {
  const senha = await bcrypt.hash("ctpwork123", 10);

  // Tipos de projeto, setores e modelos de formulário: a mesma base do banco limpo (prisma/base.ts).
  await semearConfiguracaoBase(prisma);

  const setorJuridico = await prisma.setor.upsert({
    where: { nome: "Jurídico" },
    update: {},
    create: { nome: "Jurídico" },
  });
  const setorTecnico = await prisma.setor.upsert({
    where: { nome: "Técnico" },
    update: {},
    create: { nome: "Técnico" },
  });
  const setorAdmin = await prisma.setor.upsert({
    where: { nome: "Administrativo" },
    update: {},
    create: { nome: "Administrativo" },
  });

  const municipio = await prisma.municipio.upsert({
    where: { id: "municipio-demo" },
    update: {
      nome: "Prefeitura de Guarapuava",
      contatoNome: "Secretaria Municipal de Administração",
      contatoEmail: "administracao@guarapuava.pr.gov.br",
      contatoFone: "(42) 3621-3000",
    },
    create: {
      id: "municipio-demo",
      nome: "Prefeitura de Guarapuava",
      contatoNome: "Secretaria Municipal de Administração",
      contatoEmail: "administracao@guarapuava.pr.gov.br",
      contatoFone: "(42) 3621-3000",
    },
  });

  const gestor = await prisma.user.upsert({
    where: { email: "gestor@ctp.org.br" },
    update: {},
    create: {
      nome: "Ana Coordenadora",
      email: "gestor@ctp.org.br",
      passwordHash: senha,
      tipo: "INTERNO",
      perfilInterno: "GESTOR",
      setorId: setorTecnico.id,
    },
  });

  const colaborador = await prisma.user.upsert({
    where: { email: "colaborador@ctp.org.br" },
    update: {},
    create: {
      nome: "Bruno Técnico",
      email: "colaborador@ctp.org.br",
      passwordHash: senha,
      tipo: "INTERNO",
      perfilInterno: "COLABORADOR",
      setorId: setorTecnico.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "juridico@ctp.org.br" },
    update: {},
    create: {
      nome: "Carla Jurídica",
      email: "juridico@ctp.org.br",
      passwordHash: senha,
      tipo: "INTERNO",
      perfilInterno: "COLABORADOR",
      setorId: setorJuridico.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@ctp.org.br" },
    update: {},
    create: {
      nome: "Diego Administrativo",
      email: "admin@ctp.org.br",
      passwordHash: senha,
      tipo: "INTERNO",
      perfilInterno: "COLABORADOR",
      setorId: setorAdmin.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "municipio@cilla.mg.gov.br" },
    update: {},
    create: {
      nome: "Prefeito(a) de Cilla",
      email: "municipio@cilla.mg.gov.br",
      passwordHash: senha,
      tipo: "EXTERNO",
      municipioId: municipio.id,
    },
  });

  await prisma.modeloFormulario.upsert({
    where: { id: "modelo-solicitacao-carro" },
    update: {},
    create: {
      id: "modelo-solicitacao-carro",
      nome: "Solicitação de carro",
      tipo: "MEMORANDO",
      campos: JSON.stringify([
        { chave: "data", label: "Data de uso", tipo: "date", obrigatorio: true },
        { chave: "horario", label: "Horário", tipo: "text", obrigatorio: true },
        { chave: "destino", label: "Destino", tipo: "text", obrigatorio: true },
        { chave: "motivo", label: "Motivo", tipo: "textarea", obrigatorio: false },
      ]),
    },
  });

  // Base demonstrativa rica para que o dashboard e os fluxos principais já abram preenchidos.
  const contrato = await prisma.contrato.upsert({
    where: { codigo: "CTR-2026-017" },
    update: {},
    create: {
      id: "contrato-demo-guarapuava",
      codigo: "CTR-2026-017",
      objeto: "Elaboração do Estatuto e Plano de Cargos, Carreira e Salários",
      contratanteId: municipio.id,
      etapaAtual: "TERMO_REFERENCIA_ASSINADO",
      responsavelId: gestor.id,
      tags: JSON.stringify(["prioritário", "estatuto"]),
    },
  });

  const projeto = await prisma.projeto.upsert({
    where: { codigo: "PRJ-2026-014" },
    update: {},
    create: {
      id: "projeto-demo-guarapuava",
      codigo: "PRJ-2026-014",
      tipo: "ESTATUTO_PCCS",
      contratanteId: municipio.id,
      contratoOrigemId: contrato.id,
      dataVigencia: new Date("2026-12-22T12:00:00Z"),
      responsavelId: gestor.id,
      tags: JSON.stringify(["PCCS", "Guarapuava"]),
    },
  });

  const etapasDemo = [
    { id: "etapa-info-demo", nome: "Informações iniciais", ordem: 1, status: "CONCLUIDA", temInformacoesProjeto: true },
    { id: "etapa-docs-demo", nome: "Documentos iniciais", ordem: 2, status: "EM_ANDAMENTO", temFormulario: true, temChecklist: true },
    { id: "etapa-diagnostico-demo", nome: "Diagnóstico inicial", ordem: 3, status: "NAO_INICIADA" },
    { id: "etapa-minuta-demo", nome: "Minutas versão 01", ordem: 4, status: "NAO_INICIADA", temRevisao: true },
    { id: "etapa-devolutiva-demo", nome: "Análise e devolutiva 01", ordem: 5, status: "NAO_INICIADA", temRevisao: true },
    { id: "etapa-minuta2-demo", nome: "Minutas 02", ordem: 6, status: "NAO_INICIADA", temRevisao: true },
    { id: "etapa-final-demo", nome: "Devolutiva 02", ordem: 7, status: "NAO_INICIADA", temRevisao: true },
  ];
  for (const etapa of etapasDemo) {
    // update espelha create de propósito: um upsert com update:{} nunca corrige nome/status/prazo
    // de uma etapa já semeada em um seed anterior — foi exatamente esse padrão que escondeu o bug
    // "Fase 3" vs "Fase 03" (etapa já existia, então o novo nome nunca era aplicado ao reseedar).
    const dados = {
      nome: etapa.nome, ordem: etapa.ordem, tipoFluxo: "ESTATUTO_PCCS",
      modoRevisao: "ARTIGO", status: etapa.status, responsavelId: gestor.id,
      prazo: etapa.ordem === 2 ? new Date("2026-09-22T12:00:00Z") : etapa.ordem === 3 ? new Date("2026-10-15T12:00:00Z") : null,
      temInformacoesProjeto: etapa.temInformacoesProjeto ?? false,
      temFormulario: etapa.temFormulario ?? false,
      temChecklist: etapa.temChecklist ?? false,
      temRevisao: etapa.temRevisao ?? false,
    };
    await prisma.etapaProjeto.upsert({
      where: { id: etapa.id },
      update: dados,
      create: { id: etapa.id, projetoId: projeto.id, ...dados },
    });
  }

  const docs = [
    ["check-lei", "Lei orgânica municipal", "APROVADO"],
    ["check-org", "Organograma atual", "ENVIADO"],
    ["check-cargos", "Relação completa de cargos", "PENDENTE"],
    ["check-folha", "Folha de pagamento — últimos 12 meses", "PENDENTE"],
    ["check-leg", "Legislação complementar", "PENDENTE"],
  ];
  for (const [id, nome, status] of docs) {
    await prisma.checklistItem.upsert({ where: { id }, update: {}, create: { id, etapaId: "etapa-docs-demo", nome, status } });
  }

  await prisma.eventoCronograma.upsert({ where: { id: "evento-kickoff" }, update: {}, create: { id: "evento-kickoff", projetoId: projeto.id, data: new Date("2026-09-10T12:00:00Z"), titulo: "Reunião de kick-off", descricao: "Alinhamento do cronograma e dos responsáveis.", responsavelNome: gestor.nome } });
  await prisma.eventoCronograma.upsert({ where: { id: "evento-documentos" }, update: {}, create: { id: "evento-documentos", projetoId: projeto.id, data: new Date("2026-09-22T12:00:00Z"), titulo: "Entrega dos documentos iniciais", descricao: "Prazo para concluir o checklist obrigatório.", responsavelNome: "Prefeitura de Guarapuava" } });
  await prisma.eventoCronograma.upsert({ where: { id: "evento-diagnostico" }, update: {}, create: { id: "evento-diagnostico", projetoId: projeto.id, data: new Date("2026-10-15T12:00:00Z"), titulo: "Diagnóstico inicial", descricao: "Apresentação técnica dos achados preliminares.", responsavelNome: colaborador.nome } });

  const usuarioMunicipio = await prisma.user.findUniqueOrThrow({ where: { email: "municipio@cilla.mg.gov.br" } });
  await prisma.mensagemChat.upsert({ where: { id: "msg-demo-1" }, update: {}, create: { id: "msg-demo-1", etapaId: "etapa-docs-demo", autorId: gestor.id, texto: "Olá! O organograma foi recebido e está em análise. Precisamos agora da relação completa de cargos." } });
  await prisma.mensagemChat.upsert({ where: { id: "msg-demo-2" }, update: {}, create: { id: "msg-demo-2", etapaId: "etapa-docs-demo", autorId: usuarioMunicipio.id, texto: "Estamos providenciando os documentos restantes e faremos o envio até sexta-feira." } });

  const anexoMinuta = await prisma.anexo.upsert({ where: { id: "anexo-minuta-demo" }, update: {}, create: { id: "anexo-minuta-demo", nomeOriginal: "minuta_pccs_v3.pdf", caminho: "/file.svg", tamanho: 1840000, tipoMime: "application/pdf" } });
  const documento = await prisma.documentoVersionado.upsert({ where: { id: "documento-minuta-demo" }, update: {}, create: { id: "documento-minuta-demo", etapaId: "etapa-minuta-demo", versao: 3, nomeArquivo: "minuta_pccs_v3.pdf", arquivoId: anexoMinuta.id, criadoPorId: gestor.id, enviadoEm: new Date() } });
  for (const [index, artigo, status] of [[1, "Art. 8º — Da composição dos cargos", "APROVADO"], [2, "Art. 9º — Dos requisitos para provimento", "PENDENTE"], [3, "Art. 10 — Da progressão funcional", "PENDENTE"]] as const) {
    await prisma.unidadeRevisao.upsert({ where: { id: `unidade-demo-${index}` }, update: {}, create: { id: `unidade-demo-${index}`, documentoId: documento.id, tipo: "ARTIGO", identificador: artigo, status, autorId: usuarioMunicipio.id } });
  }

  for (const [index, acao, entidadeTipo, entidadeId, detalhe] of [
    [1, "CRIAR_PROJETO", "Projeto", projeto.id, projeto.codigo],
    [2, "MUDAR_STATUS_ETAPA", "EtapaProjeto", "etapa-docs-demo", "EM_ANDAMENTO"],
    [3, "ENVIAR_MINUTA", "EtapaProjeto", "etapa-minuta-demo", "v3"],
    [4, "REVISAR_APROVADO", "UnidadeRevisao", "unidade-demo-1", "Art. 8º"],
  ] as const) {
    await prisma.auditLog.upsert({ where: { id: `audit-demo-${index}` }, update: {}, create: { id: `audit-demo-${index}`, userId: index === 4 ? usuarioMunicipio.id : gestor.id, acao, entidadeTipo, entidadeId, detalhe } });
  }

  await prisma.modeloFormulario.upsert({
    where: { id: "modelo-documentos-iniciais" },
    update: {},
    create: {
      id: "modelo-documentos-iniciais",
      nome: "Documentos iniciais do município",
      tipo: "CONTRATO",
      campos: JSON.stringify([
        { chave: "lei_organica_url", label: "Lei Orgânica vigente (link/anexo)", tipo: "text", obrigatorio: true },
        { chave: "organograma", label: "Organograma atual", tipo: "textarea", obrigatorio: true },
        { chave: "quadro_pessoal", label: "Quadro de pessoal atual", tipo: "textarea", obrigatorio: true },
        { chave: "responsavel_contato", label: "Responsável de contato no município", tipo: "text", obrigatorio: true },
      ]),
    },
  });

  // Segundo projeto (Plano Diretor, modo DOCUMENTO_INTEIRO) para demonstrar seções + grifo/comentário (seção 7).
  const contratoPlanoDiretor = await prisma.contrato.upsert({
    where: { codigo: "CTR-2026-018" },
    update: {},
    create: {
      id: "contrato-demo-plano-diretor",
      codigo: "CTR-2026-018",
      objeto: "Elaboração do Plano Diretor Municipal",
      contratanteId: municipio.id,
      etapaAtual: "TERMO_REFERENCIA_ASSINADO",
      responsavelId: gestor.id,
      tags: JSON.stringify(["plano-diretor"]),
    },
  });
  const projetoPlanoDiretor = await prisma.projeto.upsert({
    where: { codigo: "PRJ-2026-021" },
    update: {},
    create: {
      id: "projeto-demo-plano-diretor",
      codigo: "PRJ-2026-021",
      tipo: "PLANO_DIRETOR",
      contratanteId: municipio.id,
      contratoOrigemId: contratoPlanoDiretor.id,
      dataVigencia: new Date("2027-03-30T12:00:00Z"),
      responsavelId: colaborador.id,
      tags: JSON.stringify(["Plano Diretor", "Guarapuava"]),
    },
  });
  const etapasPlanoDiretor = [
    { id: "etapa-pd-info-demo", nome: "Informações iniciais", ordem: 1, status: "CONCLUIDA", temInformacoesProjeto: true },
    { id: "etapa-pd-docs-demo", nome: "Documentos iniciais", ordem: 2, status: "CONCLUIDA", temFormulario: true, temChecklist: true },
    { id: "etapa-pd-fase1-demo", nome: "Fase 01 — Leitura técnica e comunitária", ordem: 3, status: "EM_ANDAMENTO", temRevisao: true, prazo: new Date("2026-09-10T12:00:00Z") },
    { id: "etapa-pd-fase2-demo", nome: "Fase 02 — Diretrizes e propostas", ordem: 4, status: "NAO_INICIADA", temRevisao: true },
    { id: "etapa-pd-fase3-demo", nome: "Fase 03 — Minuta do projeto de lei", ordem: 5, status: "NAO_INICIADA", temRevisao: true },
    { id: "etapa-pd-fase4-demo", nome: "Fase 04 — Audiência pública", ordem: 6, status: "NAO_INICIADA", temChecklist: true },
    { id: "etapa-pd-fase5-demo", nome: "Fase 05 — Versão final e envio à Câmara", ordem: 7, status: "NAO_INICIADA", temRevisao: true },
  ];
  for (const etapa of etapasPlanoDiretor) {
    // update espelha create — ver comentário equivalente no loop de etapasDemo acima.
    const dados = {
      nome: etapa.nome, ordem: etapa.ordem, tipoFluxo: "PLANO_DIRETOR",
      modoRevisao: "DOCUMENTO_INTEIRO", status: etapa.status, responsavelId: colaborador.id,
      prazo: "prazo" in etapa ? etapa.prazo : null,
      temInformacoesProjeto: etapa.temInformacoesProjeto ?? false,
      temFormulario: etapa.temFormulario ?? false,
      temChecklist: etapa.temChecklist ?? false,
      temRevisao: etapa.temRevisao ?? false,
    };
    await prisma.etapaProjeto.upsert({
      where: { id: etapa.id },
      update: dados,
      create: { id: etapa.id, projetoId: projetoPlanoDiretor.id, ...dados },
    });
  }

  const anexoPlanoDiretor = await prisma.anexo.upsert({
    where: { id: "anexo-plano-diretor-demo" },
    update: {},
    create: { id: "anexo-plano-diretor-demo", nomeOriginal: "plano_diretor_fase1_v1.pdf", caminho: "/file.svg", tamanho: 2380000, tipoMime: "application/pdf" },
  });
  const documentoPlanoDiretor = await prisma.documentoVersionado.upsert({
    where: { id: "documento-plano-diretor-demo" },
    update: {},
    create: { id: "documento-plano-diretor-demo", etapaId: "etapa-pd-fase1-demo", versao: 1, nomeArquivo: "plano_diretor_fase1_v1.pdf", arquivoId: anexoPlanoDiretor.id, criadoPorId: colaborador.id, enviadoEm: new Date() },
  });
  await prisma.unidadeRevisao.upsert({
    where: { id: "unidade-pd-documento-inteiro" },
    update: {},
    create: { id: "unidade-pd-documento-inteiro", documentoId: documentoPlanoDiretor.id, tipo: "DOCUMENTO_INTEIRO", identificador: "documento_inteiro", status: "PENDENTE", autorId: colaborador.id },
  });

  const secoesPlanoDiretor = [
    { id: "secao-pd-1", ordem: 0, titulo: "Diagnóstico territorial", conteudo: "Conteúdo da seção \"Diagnóstico territorial\", extraído de plano_diretor_fase1_v1.pdf. Consulte o arquivo original para o texto integral desta parte do documento. Selecione um trecho abaixo para comentar ou grifar um ponto específico desta seção." },
    { id: "secao-pd-2", ordem: 1, titulo: "Zoneamento urbano proposto", conteudo: "Conteúdo da seção \"Zoneamento urbano proposto\", extraído de plano_diretor_fase1_v1.pdf. Consulte o arquivo original para o texto integral desta parte do documento. Selecione um trecho abaixo para comentar ou grifar um ponto específico desta seção." },
    { id: "secao-pd-3", ordem: 2, titulo: "Diretrizes de mobilidade", conteudo: "Conteúdo da seção \"Diretrizes de mobilidade\", extraído de plano_diretor_fase1_v1.pdf. Consulte o arquivo original para o texto integral desta parte do documento. Selecione um trecho abaixo para comentar ou grifar um ponto específico desta seção." },
  ];
  for (const secao of secoesPlanoDiretor) {
    await prisma.secaoDocumento.upsert({ where: { id: secao.id }, update: {}, create: { id: secao.id, documentoId: documentoPlanoDiretor.id, ordem: secao.ordem, titulo: secao.titulo, conteudo: secao.conteudo } });
  }
  await prisma.comentarioDocumento.upsert({
    where: { id: "comentario-pd-1" },
    update: {},
    create: {
      id: "comentario-pd-1",
      secaoId: "secao-pd-1",
      trechoInicio: 0,
      trechoFim: 38,
      trechoTexto: "Conteúdo da seção \"Diagnóstico territ",
      comentario: "Falta incluir os dados do último censo demográfico nesta seção.",
      autorId: usuarioMunicipio.id,
    },
  });

  console.log("Seed concluído.");
  console.log("Login interno gestor:      gestor@ctp.org.br / ctpwork123");
  console.log("Login interno colaborador: colaborador@ctp.org.br / ctpwork123");
  console.log("Login externo (município): municipio@cilla.mg.gov.br / ctpwork123");
  console.log({ setorJuridico: setorJuridico.id, colaborador: colaborador.id, gestor: gestor.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
