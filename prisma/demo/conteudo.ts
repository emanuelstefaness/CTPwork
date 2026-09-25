import type { Bloco } from "./pdf";

// Textos-base dos documentos anexados (checklist, contratos, memorandos). São PDFs curtos, mas
// reais: abrem em /api/files/[id] e trazem conteúdo coerente com o que o nome do arquivo promete.

export type DocBase = { titulo: string; paragrafos: string[] };

export type ChaveChecklist =
  | "lei-organica" | "organograma" | "cargos" | "folha" | "legislacao"
  | "perimetro" | "uso-solo" | "ppa" | "cartografia" | "infra"
  | "cadastro-habitacional" | "plano-diretor-vigente" | "mapa-bairros";

export function docChecklist(chave: ChaveChecklist, municipio: string): DocBase {
  const M = municipio.replace("Prefeitura de ", "");
  switch (chave) {
    case "lei-organica":
      return { titulo: `Lei Orgânica do Município de ${M}`, paragrafos: [
        `Nós, representantes do povo de ${M}, reunidos em Câmara Municipal, sob a proteção de Deus, promulgamos a presente Lei Orgânica como expressão da autonomia política, administrativa e financeira do Município.`,
        "Art. 1º O Município é entidade federativa de direito público interno, com autonomia política, legislativa, administrativa e financeira, nos termos da Constituição Federal.",
        "Art. 2º São Poderes do Município, independentes e harmônicos entre si, o Legislativo e o Executivo.",
        "Art. 3º Constituem objetivos fundamentais do Município: garantir o desenvolvimento local, erradicar a pobreza e reduzir as desigualdades sociais e territoriais.",
        "Texto consolidado com as emendas aprovadas até o exercício de 2024.",
      ] };
    case "organograma":
      return { titulo: `Organograma da Administração Municipal — ${M}`, paragrafos: [
        "Gabinete do Prefeito e Procuradoria-Geral do Município.",
        "Secretaria Municipal de Administração (Recursos Humanos, Patrimônio, Compras e Licitações).",
        "Secretaria Municipal de Fazenda (Tributos, Contabilidade, Tesouraria).",
        "Secretaria Municipal de Planejamento e Obras (Projetos, Fiscalização, Serviços Urbanos).",
        "Secretaria Municipal de Saúde, de Educação e de Assistência Social.",
        "Estrutura vigente após a reorganização administrativa de julho de 2026.",
      ] };
    case "cargos":
      return { titulo: `Relação completa de cargos — ${M}`, paragrafos: [
        "Cargos de provimento efetivo, com código, denominação, quantitativo de vagas e vagas ocupadas:",
        "ADM-01 Assistente Administrativo — 120 vagas, 104 ocupadas.",
        "SAU-03 Enfermeiro — 46 vagas, 41 ocupadas.",
        "EDU-02 Professor de Educação Infantil — 180 vagas, 172 ocupadas.",
        "OBR-05 Engenheiro Civil — 8 vagas, 6 ocupadas.",
        "JUR-01 Procurador Municipal — 5 vagas, 4 ocupadas.",
        "Cargos temporários listados em anexo separado, com data de término de cada contrato.",
      ] };
    case "folha":
      return { titulo: `Folha de pagamento — últimos 12 meses (${M})`, paragrafos: [
        "Resumo mensal da despesa bruta com pessoal (ativos, incluindo encargos patronais):",
        "Set/2025: R$ 4.218.300,00     Out/2025: R$ 4.221.870,00     Nov/2025: R$ 4.244.150,00",
        "Dez/2025: R$ 6.310.420,00 (inclui 13º salário)     Jan/2026: R$ 4.301.900,00     Fev/2026: R$ 4.298.760,00",
        "Mar/2026: R$ 4.322.410,00     Abr/2026: R$ 4.330.050,00     Mai/2026: R$ 4.351.290,00",
        "Jun/2026: R$ 4.360.820,00     Jul/2026: R$ 4.372.640,00     Ago/2026: R$ 4.385.100,00",
        "Despesa total com pessoal em relação à receita corrente líquida: 47,8% (limite prudencial: 51,3%).",
      ] };
    case "legislacao":
      return { titulo: `Legislação complementar sobre pessoal — ${M}`, paragrafos: [
        "Lei Municipal do Regime Jurídico dos Servidores Públicos (texto consolidado).",
        "Lei do Plano de Cargos e Vencimentos vigente e respectivas alterações.",
        "Decreto de regulamentação do estágio probatório.",
        "Lei do Fundo de Previdência Municipal e regras de aposentadoria.",
        "Resoluções da Câmara Municipal sobre gratificações e adicionais.",
      ] };
    case "perimetro":
      return { titulo: `Lei do perímetro urbano — ${M}`, paragrafos: [
        `Art. 1º Fica delimitado o perímetro urbano do Município de ${M}, conforme memorial descritivo constante do Anexo I.`,
        "Art. 2º As áreas inseridas no perímetro urbano ficam sujeitas às normas de parcelamento, uso e ocupação do solo.",
        "Art. 3º Alterações do perímetro dependem de lei específica, precedida de estudo técnico e audiência pública.",
        "Memorial descritivo com 214 vértices georreferenciados no sistema SIRGAS 2000.",
      ] };
    case "uso-solo":
      return { titulo: `Legislação de uso e ocupação do solo — ${M}`, paragrafos: [
        "Lei de Zoneamento, Uso e Ocupação do Solo (texto consolidado).",
        "Lei de Parcelamento do Solo Urbano e regulamentação de condomínios.",
        "Código de Obras e Edificações.",
        "Parâmetros vigentes: taxa de ocupação, coeficiente de aproveitamento, recuos e gabaritos por zona.",
      ] };
    case "ppa":
      return { titulo: `Plano Plurianual (PPA) 2026–2029 — ${M}`, paragrafos: [
        "Programas temáticos: Saúde, Educação, Infraestrutura Urbana, Desenvolvimento Econômico, Meio Ambiente e Gestão Pública.",
        "Total de recursos previstos para o quadriênio: R$ 1,12 bilhão.",
        "Metas prioritárias: universalização do saneamento, ampliação da atenção primária e modernização da mobilidade urbana.",
      ] };
    case "cartografia":
      return { titulo: `Base cartográfica georreferenciada — memorial (${M})`, paragrafos: [
        "Sistema de referência: SIRGAS 2000, projeção UTM zona 22S.",
        "Camadas disponíveis: limite municipal, perímetro urbano, quadras, lotes, hidrografia, sistema viário, equipamentos públicos.",
        "Fonte: cadastro imobiliário municipal e ortoimagem de 2024 (resolução de 10 cm).",
        "Arquivos vetoriais completos enviados em formato shapefile por meio de transferência separada.",
      ] };
    case "infra":
      return { titulo: `Relatório de infraestrutura urbana — ${M}`, paragrafos: [
        "Abastecimento de água: cobertura de 99% dos domicílios urbanos.",
        "Esgotamento sanitário: cobertura de 84% dos domicílios urbanos; meta de universalização em 2033.",
        "Drenagem: 11 bacias com sistemas subdimensionados; 42 pontos de alagamento cadastrados.",
        "Pavimentação: 91% das vias urbanas; iluminação pública 100% em LED nas vias arteriais.",
      ] };
    case "cadastro-habitacional":
      return { titulo: `Cadastro habitacional existente — ${M}`, paragrafos: [
        "Famílias inscritas no cadastro único de habitação: 1.284.",
        "Faixa de renda predominante: até 2 salários mínimos (78% dos inscritos).",
        "Demanda por bairro e tipologia (aluguel social, regularização e novas unidades) em planilha anexa.",
      ] };
    case "plano-diretor-vigente":
      return { titulo: `Plano Diretor vigente — ${M}`, paragrafos: [
        "Lei Complementar do Plano Diretor Municipal (última revisão há mais de dez anos).",
        "Macrozoneamento, instrumentos urbanísticos e diretrizes setoriais em vigor.",
        "Anexos cartográficos: mapas de zoneamento e do sistema viário estrutural.",
      ] };
    case "mapa-bairros":
      return { titulo: `Mapa dos bairros prioritários — ${M}`, paragrafos: [
        "Bairros prioritários para o levantamento: Centro Sul, Vila Nova, São Cristóvão, Jardim Primavera, Alto da Colina e Rio Bonito.",
        "Critérios de priorização: renda média, precariedade habitacional e proximidade de áreas de risco.",
      ] };
  }
}

export function blocosDeDoc(doc: DocBase): Bloco[] {
  return [
    { estilo: "titulo", texto: doc.titulo },
    ...doc.paragrafos.map((texto): Bloco => ({ estilo: "texto", texto })),
  ];
}

const ROTULO_ETAPA_CONTRATO: Record<string, string> = {
  PEDIDO_ORCAMENTO: "Pedido de orçamento",
  EMISSAO_ORCAMENTO: "Emissão de orçamento",
  APROVACAO_ORCAMENTO: "Aprovação de orçamento",
  DOCUMENTOS_CONTRATACAO: "Documentos para contratação",
  TERMO_REFERENCIA_MINUTA: "Minuta do contrato e termo de referência",
  TERMO_REFERENCIA_ASSINADO: "Contrato e termo de referência assinados",
};
export { ROTULO_ETAPA_CONTRATO };

export function docContrato(tipo: "pedido" | "orcamento" | "certidoes" | "minuta" | "assinado", codigo: string, objeto: string, municipio: string, valor: string): DocBase {
  switch (tipo) {
    case "pedido":
      return { titulo: `Pedido de orçamento — ${codigo}`, paragrafos: [
        `Solicitante: ${municipio}.`,
        `Objeto: ${objeto}.`,
        "O Município solicita ao Cilla Tech Park o envio de proposta técnica e comercial para a execução do objeto acima, com cronograma, equipe técnica e produtos previstos.",
        "Justificativa: necessidade de atualizar o instrumento de planejamento municipal e atender a exigências legais e de órgãos de controle.",
      ] };
    case "orcamento":
      return { titulo: `Proposta técnica e comercial — ${codigo}`, paragrafos: [
        `Objeto: ${objeto}.`,
        "Escopo: diagnóstico, elaboração de minutas, oficinas participativas, audiência pública e entrega da versão final consolidada.",
        `Valor global: ${valor}, em parcelas vinculadas à aprovação de cada etapa.`,
        "Prazo de execução: 10 meses contados da assinatura do contrato. Validade da proposta: 60 dias.",
        "Equipe mínima: coordenação, analista técnico sênior, especialista jurídico e apoio administrativo.",
      ] };
    case "certidoes":
      return { titulo: `Documentos para contratação — ${codigo}`, paragrafos: [
        `Contratante: ${municipio}.`,
        "Certidões negativas federal, estadual e municipal em nome da contratante.",
        "Ato de designação do gestor e do fiscal do contrato.",
        "Parecer jurídico favorável à contratação e dotação orçamentária empenhada.",
      ] };
    case "minuta":
      return { titulo: `Minuta de contrato e termo de referência — ${codigo}`, paragrafos: [
        `Objeto: ${objeto}.`,
        `Valor: ${valor}. Vigência: 12 meses, prorrogável nos termos da Lei nº 14.133/2021.`,
        "Cláusula primeira — Do objeto e dos produtos a serem entregues.",
        "Cláusula segunda — Das obrigações da contratada e da contratante.",
        "Cláusula terceira — Do pagamento, condicionado à aprovação formal de cada etapa pela contratante.",
        "Cláusula quarta — Da gestão e da fiscalização do contrato.",
        "Cláusula quinta — Das sanções administrativas e da rescisão.",
      ] };
    case "assinado":
      return { titulo: `Contrato assinado — ${codigo}`, paragrafos: [
        `Contratante: ${municipio}. Contratada: Cilla Tech Park.`,
        `Objeto: ${objeto}. Valor: ${valor}.`,
        "Instrumento firmado eletronicamente pelas partes, com registro de data, hora e endereço IP de cada assinatura na plataforma CTP Work.",
        "Integram este contrato o termo de referência e a proposta técnica e comercial aprovada.",
      ] };
  }
}
