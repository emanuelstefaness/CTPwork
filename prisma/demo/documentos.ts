// Conteúdo dos documentos de demonstração: artigos (modo ARTIGO) e seções com grifos/comentários
// (modo DOCUMENTO_INTEIRO). Os trechos grifados são localizados por texto (indexOf) no seed, então
// cada `trecho` abaixo precisa existir literalmente dentro do `conteudo` da sua seção.

export type Autor = "ana" | "bruno" | "carla" | "diego" | "marina" | "cilla" | "helena" | "rogerio" | "juliana" | "ricardo" | "tatiane" | "eduardo";

export type ComentarioSpec = { trecho: string; autor: Autor; texto: string; resolvido: boolean; quando: string };
export type SecaoSpec = { titulo: string; conteudo: string; comentarios: ComentarioSpec[] };
export type ArtigoSpec = { identificador: string; conteudo: string; status: "APROVADO" | "REPROVADO" | "PENDENTE"; revisor: Autor; comentario?: string };

// ─────────────────────────────── Estatuto e PCCS (modo ARTIGO) ───────────────────────────────

export const ARTIGOS_PCCS_V3: ArtigoSpec[] = [
  {
    identificador: "Art. 8º — Da composição dos cargos",
    conteudo: `Os cargos de provimento efetivo do Município integram o Quadro Permanente de Pessoal e organizam-se em carreiras, classes e referências, na forma do Anexo I desta Lei.\n§ 1º Cada cargo será identificado por denominação, código, natureza das atribuições, requisitos de escolaridade e vencimento-base.\n§ 2º Fica vedada a criação de cargos em comissão para o exercício de atribuições técnicas de natureza permanente.`,
    status: "APROVADO",
    revisor: "marina",
  },
  {
    identificador: "Art. 9º — Dos requisitos para provimento",
    conteudo: `O provimento dos cargos efetivos dependerá de aprovação prévia em concurso público de provas ou de provas e títulos, observados os requisitos mínimos de escolaridade e habilitação profissional fixados no Anexo II.\nParágrafo único. O candidato deverá comprovar, no ato da posse, aptidão física e mental, quitação eleitoral e militar e ausência de acúmulo ilegal de cargos, empregos ou funções públicas.`,
    status: "REPROVADO",
    revisor: "marina",
    comentario: "O município solicita que seja prevista a exigência de experiência mínima de 2 anos para os cargos de nível superior da área da saúde, conforme prática atual da Secretaria.",
  },
  {
    identificador: "Art. 10 — Da progressão funcional",
    conteudo: `A progressão funcional é a movimentação do servidor de uma referência para a imediatamente superior dentro da mesma classe, mediante avaliação de desempenho satisfatória e cumprimento do interstício mínimo de 24 (vinte e quatro) meses de efetivo exercício.`,
    status: "APROVADO",
    revisor: "marina",
  },
  {
    identificador: "Art. 11 — Da promoção",
    conteudo: `A promoção consiste na passagem do servidor de uma classe para a imediatamente superior, dependendo de titulação adicional compatível com as atribuições do cargo e de interstício mínimo de 5 (cinco) anos na classe anterior.\nParágrafo único. A promoção observará a disponibilidade orçamentária e o limite de despesa com pessoal estabelecido pela Lei de Responsabilidade Fiscal.`,
    status: "PENDENTE",
    revisor: "bruno",
  },
  {
    identificador: "Art. 12 — Da avaliação de desempenho",
    conteudo: `A avaliação de desempenho será realizada anualmente por comissão paritária, com base em critérios objetivos de assiduidade, produtividade, iniciativa, responsabilidade e capacitação, na forma de regulamento.\nParágrafo único. O servidor poderá apresentar recurso fundamentado no prazo de 10 (dez) dias contados da ciência do resultado.`,
    status: "PENDENTE",
    revisor: "bruno",
  },
  {
    identificador: "Art. 13 — Da jornada de trabalho",
    conteudo: `A jornada de trabalho dos servidores do Quadro Permanente será de 40 (quarenta) horas semanais, ressalvadas as jornadas reduzidas previstas em legislação específica para as categorias profissionais reguladas.`,
    status: "APROVADO",
    revisor: "marina",
  },
  {
    identificador: "Art. 14 — Do adicional por titulação",
    conteudo: `Ao servidor que concluir curso de pós-graduação lato ou stricto sensu compatível com as atribuições do cargo será concedido adicional de 5% (especialização), 10% (mestrado) ou 15% (doutorado) sobre o vencimento-base.`,
    status: "REPROVADO",
    revisor: "marina",
    comentario: "Os percentuais propostos superam a capacidade orçamentária informada pela Secretaria de Fazenda. Solicitamos reavaliar para 3%, 6% e 10%, respectivamente.",
  },
  {
    identificador: "Art. 15 — Das disposições transitórias",
    conteudo: `Os servidores em exercício na data de publicação desta Lei serão enquadrados nos novos cargos mediante processo de enquadramento conduzido por comissão instituída por decreto do Chefe do Poder Executivo, no prazo de 180 (cento e oitenta) dias.`,
    status: "PENDENTE",
    revisor: "bruno",
  },
];

/** Versões anteriores da minuta (histórico): mesmas ideias, redação mais antiga. */
export const ARTIGOS_PCCS_V1: ArtigoSpec[] = [
  { identificador: "Art. 8º — Da composição dos cargos", conteudo: `Os cargos do Município organizam-se em carreiras conforme o Anexo I, sem previsão expressa de vedação a cargos em comissão de natureza técnica.`, status: "REPROVADO", revisor: "marina", comentario: "Incluir vedação expressa a cargos comissionados em atribuições técnicas permanentes." },
  { identificador: "Art. 9º — Dos requisitos para provimento", conteudo: `O provimento dependerá de concurso público, observados os requisitos do Anexo II.`, status: "REPROVADO", revisor: "marina", comentario: "Redação genérica; detalhar documentos exigidos na posse." },
  { identificador: "Art. 10 — Da progressão funcional", conteudo: `A progressão ocorrerá a cada 36 meses de efetivo exercício mediante avaliação.`, status: "REPROVADO", revisor: "marina", comentario: "O interstício de 36 meses foi considerado longo; a Secretaria sugere 24 meses." },
];

export const ARTIGOS_PCCS_V2: ArtigoSpec[] = [
  { identificador: "Art. 8º — Da composição dos cargos", conteudo: `Os cargos de provimento efetivo integram o Quadro Permanente de Pessoal, organizados em carreiras, classes e referências (Anexo I). Fica vedada a criação de cargos em comissão para atribuições técnicas permanentes.`, status: "APROVADO", revisor: "marina" },
  { identificador: "Art. 9º — Dos requisitos para provimento", conteudo: `O provimento dependerá de concurso público de provas ou de provas e títulos, observados os requisitos do Anexo II. A posse exige comprovação de aptidão, quitação eleitoral e militar.`, status: "APROVADO", revisor: "marina" },
  { identificador: "Art. 10 — Da progressão funcional", conteudo: `A progressão funcional ocorrerá a cada 24 meses de efetivo exercício, mediante avaliação de desempenho satisfatória.`, status: "APROVADO", revisor: "marina" },
  { identificador: "Art. 11 — Da promoção", conteudo: `A promoção depende de titulação adicional e de interstício mínimo de 5 anos na classe anterior.`, status: "REPROVADO", revisor: "marina", comentario: "Necessário prever limite orçamentário e vinculação à LRF antes de aprovarmos." },
  { identificador: "Art. 12 — Da avaliação de desempenho", conteudo: `A avaliação será anual, por comissão paritária, conforme regulamento.`, status: "APROVADO", revisor: "marina" },
];

// ───────────────────────── Plano Diretor — Guarapuava (Fase 01, v2) ─────────────────────────

export const SECOES_PD_GUARAPUAVA_V2: SecaoSpec[] = [
  {
    titulo: "Diagnóstico territorial",
    conteudo: `O território de Guarapuava abrange 3.117 km², dos quais aproximadamente 71 km² correspondem ao perímetro urbano vigente. A ocupação urbana desenvolveu-se de forma radial a partir do centro histórico, com expansão acelerada nas últimas duas décadas em direção aos eixos das rodovias BR-277 e BR-466. O diagnóstico identificou 14 vazios urbanos de grande porte, totalizando cerca de 6,4 km² de áreas servidas por infraestrutura e subutilizadas. Verificou-se, ainda, que 18% dos loteamentos aprovados desde 2010 permanecem com menos de 30% de ocupação, o que indica retenção especulativa de terrenos e pressiona a expansão horizontal da malha urbana.`,
    comentarios: [
      { trecho: "3.117 km²", autor: "marina", texto: "A área oficial do município segundo o IBGE é de 3.168 km². Favor conferir a fonte utilizada.", resolvido: false, quando: "2026-09-18T11:05:00-03:00" },
      { trecho: "14 vazios urbanos de grande porte", autor: "bruno", texto: "Levantamento feito por fotointerpretação de ortoimagem 2024; mapa completo no Anexo Cartográfico 03.", resolvido: true, quando: "2026-09-19T09:30:00-03:00" },
    ],
  },
  {
    titulo: "Perfil socioeconômico e demográfico",
    conteudo: `A população estimada em 2025 é de 183.400 habitantes, com taxa de urbanização de 92,6%. A taxa geométrica de crescimento anual entre 2010 e 2022 foi de 1,08%, inferior à média estadual. A pirâmide etária evidencia envelhecimento gradual: a população com 60 anos ou mais passou de 9,4% para 14,1% no período. A renda domiciliar média mensal é de 3,2 salários mínimos, com forte concentração de domicílios com renda inferior a 2 salários mínimos nos bairros da região sul, onde se concentram também os maiores déficits de saneamento e de equipamentos de saúde e educação.`,
    comentarios: [
      { trecho: "183.400 habitantes", autor: "marina", texto: "Os dados do Censo 2022 indicam 182.093. Sugerimos alinhar a base populacional em todo o documento.", resolvido: false, quando: "2026-09-18T11:12:00-03:00" },
      { trecho: "taxa geométrica de crescimento anual", autor: "ana", texto: "Metodologia detalhada na Nota Técnica NT-02 (projeção populacional pelo método AiBi).", resolvido: true, quando: "2026-09-19T10:02:00-03:00" },
      { trecho: "região sul", autor: "marina", texto: "Solicitamos incluir também os bairros Vila Carli e Boqueirão nesta caracterização; há demandas recentes da Secretaria de Assistência Social.", resolvido: true, quando: "2026-09-18T11:20:00-03:00" },
    ],
  },
  {
    titulo: "Zoneamento urbano proposto",
    conteudo: `A proposta de zoneamento organiza o território urbano em sete macrozonas: Zona de Adensamento Prioritário, Zona de Qualificação Urbana, Zona de Expansão Controlada, Zona de Proteção Ambiental, Zona Industrial e Logística, Zona Rural de Transição e Zona Central Histórica. O coeficiente de aproveitamento básico será de 1,0 em todo o perímetro urbano, com possibilidade de acréscimo até 4,0 nas áreas de adensamento prioritário mediante outorga onerosa do direito de construir. As áreas lindeiras aos corredores de transporte coletivo poderão receber gabaritos diferenciados, respeitados os limites de proteção do patrimônio edificado.`,
    comentarios: [
      { trecho: "coeficiente de aproveitamento básico será de 1,0", autor: "marina", texto: "A Procuradoria questiona a adoção de CA básico único; na legislação atual há variação por zona. Precisamos avaliar o impacto arrecadatório.", resolvido: false, quando: "2026-09-18T14:40:00-03:00" },
      { trecho: "outorga onerosa do direito de construir", autor: "marina", texto: "De acordo. Solicitamos simulação de arrecadação estimada para os próximos 10 anos.", resolvido: false, quando: "2026-09-18T14:52:00-03:00" },
      { trecho: "sete macrozonas", autor: "bruno", texto: "Mapa de macrozoneamento disponível na Prancha 07 (formato A1) — enviado por e-mail à Secretaria de Planejamento.", resolvido: true, quando: "2026-09-19T15:10:00-03:00" },
    ],
  },
  {
    titulo: "Diretrizes de mobilidade",
    conteudo: `As diretrizes de mobilidade priorizam o transporte coletivo, a mobilidade ativa e a integração modal. Propõe-se a implantação de 42 km de ciclovias e ciclofaixas conectando os principais polos geradores de viagens, a requalificação de 60 km de calçadas em rotas acessíveis e a criação de três terminais de integração nos eixos Norte, Sul e Leste. Recomenda-se a hierarquização viária conforme função e capacidade, com moderação de tráfego (zonas 30) no entorno de escolas e unidades de saúde e a restrição de circulação de veículos pesados na área central em horários de pico.`,
    comentarios: [
      { trecho: "42 km de ciclovias e ciclofaixas", autor: "marina", texto: "Excelente proposta. Precisamos verificar a compatibilidade com o Plano de Mobilidade em elaboração (CTR-2026-025); vamos alinhar em reunião.", resolvido: true, quando: "2026-09-18T15:30:00-03:00" },
      { trecho: "três terminais de integração", autor: "ana", texto: "Localizações preliminares dependem do estudo de demanda do Plano de Mobilidade; serão consolidadas na Fase 02.", resolvido: true, quando: "2026-09-19T15:25:00-03:00" },
    ],
  },
  {
    titulo: "Habitação de interesse social",
    conteudo: `O déficit habitacional estimado é de 6.820 domicílios, dos quais 62% correspondem ao ônus excessivo com aluguel e 21% a habitações precárias. Propõe-se a delimitação de Zonas Especiais de Interesse Social (ZEIS) em 23 áreas, sendo 9 de regularização fundiária e 14 de produção de novas unidades. Cada ZEIS terá plano de urbanização específico, com parâmetros urbanísticos próprios e instrumentos como a demarcação urbanística e a legitimação fundiária, conforme a Lei Federal nº 13.465/2017.`,
    comentarios: [
      { trecho: "23 áreas", autor: "marina", texto: "A Companhia de Habitação identificou apenas 19 áreas passíveis de regularização. Encaminharemos a listagem oficial até sexta-feira.", resolvido: false, quando: "2026-09-20T09:15:00-03:00" },
      { trecho: "Lei Federal nº 13.465/2017", autor: "marina", texto: "Incluir também referência à lei municipal de REURB vigente.", resolvido: true, quando: "2026-09-20T09:22:00-03:00" },
    ],
  },
  {
    titulo: "Meio ambiente e áreas de preservação",
    conteudo: `Foram mapeadas 1.240 nascentes e 312 km de cursos d'água na área urbana e de expansão urbana, associados às bacias dos rios Coutinho, Cascavel e Xarquinho. Propõe-se a ampliação das faixas de preservação permanente para 30 metros em áreas urbanas consolidadas, a criação de dois parques lineares e a implantação de um sistema de corredores ecológicos conectando remanescentes de Floresta Ombrófila Mista. Os empreendimentos em áreas de recarga de aquífero deverão apresentar estudo hidrogeológico específico.`,
    comentarios: [
      { trecho: "1.240 nascentes", autor: "marina", texto: "Número muito acima do cadastro da Secretaria de Meio Ambiente (860). Solicitamos apresentar o método de mapeamento.", resolvido: false, quando: "2026-09-20T10:05:00-03:00" },
      { trecho: "dois parques lineares", autor: "ana", texto: "Parque do Rio Coutinho e Parque do Rio Cascavel, conforme definido na reunião técnica de 12/09.", resolvido: true, quando: "2026-09-20T16:40:00-03:00" },
    ],
  },
];

// ───────────────────────── Plano Diretor — Pato Branco (Fase 01, v1) ─────────────────────────

export const SECOES_PD_PATOBRANCO_V1: SecaoSpec[] = [
  {
    titulo: "Caracterização do município",
    conteudo: `Pato Branco localiza-se no Sudoeste do Paraná, com área territorial de 539 km² e população estimada em 87.500 habitantes. O município é polo regional de educação superior, comércio e serviços, atraindo diariamente população flutuante estimada em 25 mil pessoas dos municípios vizinhos. A economia combina agroindústria, tecnologia da informação e serviços educacionais. O crescimento urbano concentra-se nos vetores norte e oeste, com pressão sobre áreas de várzea do Rio Ligeiro.`,
    comentarios: [
      { trecho: "população estimada em 87.500 habitantes", autor: "juliana", texto: "Segundo o Censo 2022 a população é de 92.228. Solicitamos atualização.", resolvido: false, quando: "2026-09-16T10:10:00-03:00" },
      { trecho: "população flutuante estimada em 25 mil pessoas", autor: "bruno", texto: "Estimativa a partir de matrículas das IES e do fluxo de transporte intermunicipal (fonte: ANTT).", resolvido: true, quando: "2026-09-17T09:00:00-03:00" },
    ],
  },
  {
    titulo: "Uso e ocupação do solo atual",
    conteudo: `O levantamento cadastral identificou 41.260 lotes urbanos, dos quais 8,7% encontram-se vazios e 3,1% subutilizados. O uso residencial predomina (68%), seguido do comercial e de serviços (19%), industrial (6%) e institucional (7%). Observa-se conflito entre usos residenciais e industriais no entorno da PR-493 e ocupação irregular em faixas de preservação do Rio Ligeiro, totalizando 214 edificações em situação de risco de inundação.`,
    comentarios: [
      { trecho: "214 edificações", autor: "juliana", texto: "A Defesa Civil registra 187 edificações. Vamos encaminhar o relatório oficial para conferência.", resolvido: false, quando: "2026-09-16T10:25:00-03:00" },
      { trecho: "ocupação irregular em faixas de preservação", autor: "ricardo", texto: "A Procuradoria solicita que a redação evite a caracterização jurídica de “irregular” antes da análise individual de cada caso.", resolvido: false, quando: "2026-09-16T11:40:00-03:00" },
    ],
  },
  {
    titulo: "Infraestrutura e saneamento",
    conteudo: `A cobertura de abastecimento de água atinge 99,2% dos domicílios urbanos e a de esgotamento sanitário 84,5%, com meta de universalização até 2033. Identificaram-se 11 bacias de drenagem com sistemas subdimensionados, responsáveis por 70% dos pontos de alagamento cadastrados. A pavimentação cobre 91% das vias urbanas, mas apenas 46% das vias possuem calçadas adequadas às normas de acessibilidade da ABNT NBR 9050.`,
    comentarios: [
      { trecho: "84,5%", autor: "juliana", texto: "Correto conforme dados da concessionária 2025. Nenhuma alteração necessária.", resolvido: true, quando: "2026-09-16T14:05:00-03:00" },
      { trecho: "11 bacias de drenagem", autor: "ana", texto: "Detalhamento no Anexo Técnico A4 — Macrodrenagem.", resolvido: true, quando: "2026-09-17T09:20:00-03:00" },
    ],
  },
  {
    titulo: "Macrozoneamento proposto",
    conteudo: `Propõe-se a divisão do território em cinco macrozonas: Urbana Consolidada, Urbana de Expansão Ordenada, de Interesse Econômico, de Proteção Ambiental e Rural. O perímetro urbano será ampliado em 4,2 km² ao norte, condicionado à implantação de infraestrutura e à destinação mínima de 20% da gleba para uso público. As áreas de várzea do Rio Ligeiro passam a integrar a Macrozona de Proteção Ambiental, com restrição a novas edificações.`,
    comentarios: [
      { trecho: "ampliado em 4,2 km² ao norte", autor: "juliana", texto: "Solicitamos justificar a ampliação frente ao percentual de lotes vazios apontado na seção anterior. Há posicionamento contrário do Conselho da Cidade.", resolvido: false, quando: "2026-09-17T15:00:00-03:00" },
      { trecho: "20% da gleba para uso público", autor: "bruno", texto: "Percentual compatível com o art. 4º da Lei Federal 6.766/1979 e com a prática regional.", resolvido: true, quando: "2026-09-18T10:15:00-03:00" },
    ],
  },
  {
    titulo: "Instrumentos urbanísticos",
    conteudo: `Recomenda-se a regulamentação do parcelamento, edificação e utilização compulsórios, do IPTU progressivo no tempo, da outorga onerosa do direito de construir e da transferência do direito de construir. Os recursos da outorga onerosa serão vinculados ao Fundo Municipal de Desenvolvimento Urbano, destinados prioritariamente à habitação de interesse social e à mobilidade ativa.`,
    comentarios: [
      { trecho: "IPTU progressivo no tempo", autor: "ricardo", texto: "De acordo, desde que precedido de notificação e prazos razoáveis. Ver minuta de lei complementar enviada pela Procuradoria.", resolvido: false, quando: "2026-09-18T09:30:00-03:00" },
    ],
  },
];

// ───────────────────────── Plano de Mobilidade — Guarapuava (Diagnóstico v1) ─────────────────────────

export const SECOES_MOBILIDADE_V1: SecaoSpec[] = [
  {
    titulo: "Sistema viário e circulação",
    conteudo: `A malha viária urbana soma 1.420 km, sendo 12% de vias arteriais, 18% coletoras e 70% locais. A pesquisa de tráfego em 26 seções identificou velocidades médias de 18 km/h no horário de pico nas avenidas do eixo central, com níveis de serviço E e F em 9 interseções. A frota registrada é de 118 mil veículos, o que equivale a 0,64 veículo por habitante, com crescimento médio de 4,3% ao ano nos últimos cinco anos.`,
    comentarios: [
      { trecho: "9 interseções", autor: "marina", texto: "Solicitamos a listagem dessas interseções para priorização junto à Diretoria de Trânsito.", resolvido: false, quando: "2026-09-19T10:00:00-03:00" },
      { trecho: "26 seções", autor: "ana", texto: "Contagens volumétricas realizadas de 17 a 21/08/2026, das 6h às 20h.", resolvido: true, quando: "2026-09-19T14:10:00-03:00" },
    ],
  },
  {
    titulo: "Transporte coletivo",
    conteudo: `O sistema opera 46 linhas com frota de 138 ônibus, atendendo cerca de 62 mil passageiros por dia útil. O índice de passageiros por quilômetro (IPK) é de 1,48, abaixo do referencial de equilíbrio contratual de 1,9. A tarifa técnica supera a tarifa pública em 22%, financiada por subsídio municipal. Do total, 34% dos pontos de parada não possuem abrigo e apenas 29% da frota é acessível a pessoas com deficiência.`,
    comentarios: [
      { trecho: "subsídio municipal", autor: "marina", texto: "Favor detalhar os valores anuais do subsídio; a Secretaria de Fazenda precisa dos dados para o parecer.", resolvido: false, quando: "2026-09-19T10:20:00-03:00" },
      { trecho: "29% da frota", autor: "marina", texto: "Informação confirmada pela autarquia de trânsito.", resolvido: true, quando: "2026-09-19T10:24:00-03:00" },
    ],
  },
  {
    titulo: "Mobilidade ativa",
    conteudo: `Contagens de pedestres e ciclistas mostram que 31% das viagens diárias são realizadas a pé e 3% por bicicleta. A infraestrutura cicloviária existente soma 9,5 km, desconectados entre si. Foram identificados 47 pontos críticos de conflito entre pedestres e veículos, com 12 atropelamentos registrados em 2025 nas travessias sem semaforização. As calçadas apresentam larguras inferiores a 1,2 m em 38% das vias avaliadas.`,
    comentarios: [
      { trecho: "47 pontos críticos", autor: "bruno", texto: "Mapa de pontos críticos na Prancha M-03; a priorização por índice de risco será apresentada na Fase 02.", resolvido: true, quando: "2026-09-19T16:00:00-03:00" },
      { trecho: "12 atropelamentos", autor: "marina", texto: "Nosso levantamento aponta 15 ocorrências (inclui 3 sem boletim). Vamos enviar a planilha.", resolvido: false, quando: "2026-09-20T09:40:00-03:00" },
    ],
  },
  {
    titulo: "Logística urbana e cargas",
    conteudo: `O município recebe cerca de 2.900 viagens diárias de veículos de carga, com concentração no corredor da BR-277 e na área central. A ausência de regulamentação de horários e de vagas de carga e descarga gera 340 ocorrências mensais de estacionamento irregular em vias comerciais. Recomenda-se estudar um anel viário de contorno para desviar o tráfego pesado de passagem.`,
    comentarios: [
      { trecho: "anel viário de contorno", autor: "marina", texto: "Existe projeto do DER para contorno norte; sugerimos integrar as informações ao estudo.", resolvido: false, quando: "2026-09-20T09:55:00-03:00" },
    ],
  },
];

/** Versão anterior do Plano Diretor de Guarapuava: seções resumidas + comentários já endereçados na v2. */
export const SECOES_PD_GUARAPUAVA_V1_RESUMO = `Versão preliminar da Fase 01 do Plano Diretor de Guarapuava, apresentada em 21/08/2026. Contém o diagnóstico territorial, o zoneamento urbano proposto e as diretrizes de mobilidade em formato resumido. Os comentários do município sobre esta versão foram incorporados na versão 2.`;
