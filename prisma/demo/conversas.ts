import type { Autor } from "./documentos";

export type MensagemSpec = {
  autor: Autor;
  quando: string;
  texto: string;
  anexo?: { nome: string; titulo: string; paragrafos: string[] };
  /** Reaproveita uma linha já existente no banco (mensagem de teste antiga) em vez de criar uma nova. */
  idExistente?: string;
};

const m = (autor: Autor, quando: string, texto: string, anexo?: MensagemSpec["anexo"], idExistente?: string): MensagemSpec => ({ autor, quando, texto, anexo, idExistente });

// Todas as datas em horário de Brasília (-03:00), anteriores a 21/09/2026.

export const CONVERSAS: Record<string, MensagemSpec[]> = {
  // ─────────────── Guarapuava — Estatuto e PCCS (PRJ-2026-014) ───────────────
  "etapa-info-demo": [
    m("ana", "2026-06-08T09:12:00-03:00", "Bom dia, Marina! Sou a Ana, coordenadora do projeto do Estatuto e PCCS aqui no CTP. O contrato foi assinado e o projeto já está aberto no sistema. Podemos marcar o kick-off para o dia 16/06?"),
    m("marina", "2026-06-08T10:40:00-03:00", "Bom dia, Ana! Confirmado. A Secretária de Administração e o Procurador-Geral participarão. Pode ser às 14h na sala de reuniões da Prefeitura?"),
    m("ana", "2026-06-08T10:52:00-03:00", "Perfeito, às 14h. Enviaremos a pauta e a lista de documentos iniciais na véspera."),
    m("marina", "2026-06-16T17:20:00-03:00", "Obrigada pela reunião de hoje, foi muito produtiva. Já repassei a lista de documentos às secretarias envolvidas."),
  ],
  "etapa-docs-demo": [
    m("ana", "2026-06-18T10:00:00-03:00", "Marina, a lista de documentos iniciais está no checklist desta etapa. Podem enviar os arquivos por aqui mesmo, item a item, que nossa equipe valida em até 2 dias úteis."),
    m("marina", "2026-06-19T15:32:00-03:00", "Recebido! Vou solicitar à Secretaria de Administração e à de Fazenda. A Lei Orgânica já anexei agora."),
    m("bruno", "2026-06-22T09:05:00-03:00", "Lei Orgânica validada, obrigado! Aguardamos o organograma e o quadro de pessoal."),
    m("marina", "2026-06-23T14:47:00-03:00", "Organograma anexado. O quadro de pessoal está sendo consolidado pelo RH, previsão para amanhã."),
    m("ana", "2026-06-24T16:10:00-03:00", "Olá! O organograma foi recebido e está em análise. Precisamos agora da relação completa de cargos.", undefined, "msg-demo-1"),
    m("cilla", "2026-06-25T09:30:00-03:00", "Estamos providenciando os documentos restantes e faremos o envio até sexta-feira.", undefined, "msg-demo-2"),
    m("marina", "2026-06-30T11:15:00-03:00", "Enviei a relação completa de cargos e a folha dos últimos 12 meses. Falta apenas a legislação complementar."),
    m("carla", "2026-07-01T08:50:00-03:00", "Recebi as leis complementares por e-mail e já subi no checklist. Da nossa parte, documentação completa. Vamos concluir a etapa."),
    m("ana", "2026-07-10T09:00:00-03:00", "Etapa concluída! Seguimos para o diagnóstico inicial. Obrigada pela agilidade de vocês."),
  ],
  "etapa-diagnostico-demo": [
    m("bruno", "2026-07-13T09:30:00-03:00", "Iniciamos o diagnóstico. Precisaremos de acesso às fichas funcionais amostrais e de uma reunião com o RH. Sugestão: quinta-feira, 16/07, às 10h."),
    m("marina", "2026-07-13T11:02:00-03:00", "Combinado. O RH estará à disposição; a chefe do setor, Cláudia, acompanhará a reunião."),
    m("bruno", "2026-08-04T16:20:00-03:00", "Segue o relatório de diagnóstico inicial. Destaques: 27 cargos com defasagem salarial acima de 15% e 9 cargos sem descrição de atribuições.", {
      nome: "Diagnostico_Inicial_PCCS_Guarapuava.pdf",
      titulo: "Diagnóstico inicial — Estatuto e PCCS de Guarapuava",
      paragrafos: [
        "Este relatório apresenta o diagnóstico da estrutura de cargos, carreiras e remuneração do Quadro Permanente de Pessoal do Município de Guarapuava.",
        "1. Estrutura atual: 148 cargos efetivos distribuídos em 9 grupos ocupacionais, com 4.216 servidores ativos.",
        "2. Defasagem salarial: 27 cargos apresentam vencimento-base inferior em mais de 15% à média regional de municípios de porte semelhante.",
        "3. Lacunas normativas: 9 cargos não possuem descrição formal de atribuições e 14 não têm requisitos de escolaridade atualizados.",
        "4. Progressão: 61% dos servidores estão há mais de 5 anos na mesma referência, sem movimentação por ausência de regulamentação da avaliação de desempenho.",
        "5. Recomendações: unificação de cargos análogos, regulamentação da progressão e da promoção, e criação de tabela única de vencimentos.",
      ],
    }),
    m("marina", "2026-08-06T10:10:00-03:00", "Relatório muito claro. Vamos validar internamente e retornamos até o dia 12."),
    m("marina", "2026-08-12T15:45:00-03:00", "Diagnóstico validado pela Secretaria de Administração. Podem seguir para as minutas."),
    m("ana", "2026-08-14T09:10:00-03:00", "Excelente! Diagnóstico concluído. A primeira versão das minutas sai na semana que vem."),
  ],
  "etapa-minuta-demo": [
    m("ana", "2026-08-19T14:00:00-03:00", "Marina, enviamos a versão 1 da minuta do Estatuto (artigos 8º a 10). Pedimos a revisão artigo a artigo pela plataforma."),
    m("marina", "2026-08-24T16:30:00-03:00", "Analisamos a v1 e reprovamos os três artigos com comentários. Os principais pontos: vedação a cargos comissionados em atribuições técnicas e o interstício da progressão."),
    m("carla", "2026-08-26T10:15:00-03:00", "Entendido. O Jurídico já está ajustando a redação da vedação no art. 8º e vamos rever o interstício para 24 meses, como vocês sugeriram."),
    m("bruno", "2026-09-02T11:00:00-03:00", "Versão 2 enviada com os ajustes. Incluímos também os artigos 11 e 12."),
    m("marina", "2026-09-09T09:40:00-03:00", "Aprovamos os artigos 8, 9, 10 e 12. O art. 11 (promoção) precisa de uma trava orçamentária antes de aprovarmos."),
    m("carla", "2026-09-11T15:20:00-03:00", "Sem problemas. Incluímos o parágrafo único vinculando a promoção ao limite da LRF na v3, que já está na plataforma com os artigos 13 a 15."),
    m("marina", "2026-09-16T13:05:00-03:00", "Recebemos a v3. Aprovamos os arts. 8, 10 e 13. Reprovamos o art. 9 (experiência mínima na área da saúde) e o art. 14 (adicional por titulação, pelo impacto orçamentário)."),
    m("ana", "2026-09-17T09:20:00-03:00", "Obrigada, Marina. Vamos simular o impacto do adicional por titulação com os percentuais que sugeriram (3%, 6% e 10%) e enviar a comparação antes da próxima versão.", {
      nome: "Simulacao_Adicional_Titulacao.pdf",
      titulo: "Simulação de impacto — adicional por titulação (Art. 14)",
      paragrafos: [
        "Cenário A (minuta v3): 5% especialização, 10% mestrado, 15% doutorado. Impacto anual estimado: R$ 2,84 milhões.",
        "Cenário B (proposta do município): 3% especialização, 6% mestrado, 10% doutorado. Impacto anual estimado: R$ 1,71 milhão.",
        "Premissas: 612 servidores com pós-graduação declarada, distribuídos em 486 especialistas, 104 mestres e 22 doutores; vencimento-base médio de R$ 4.180,00.",
        "Observação: os valores não incluem encargos patronais, que elevam o impacto em aproximadamente 22%.",
      ],
    }),
    m("marina", "2026-09-19T10:50:00-03:00", "Ótimo. A Secretaria de Fazenda pediu que a planilha traga também o impacto acumulado em 5 anos."),
  ],

  // ─────────────── Guarapuava — Plano Diretor (PRJ-2026-021) ───────────────
  "etapa-pd-info-demo": [
    m("bruno", "2026-06-29T09:00:00-03:00", "Bom dia, Marina! Sou o Bruno, responsável técnico do Plano Diretor. Já cadastramos o cronograma geral do projeto e as datas de entrega de cada fase."),
    m("marina", "2026-06-29T10:15:00-03:00", "Bom dia, Bruno! Recebemos. A Secretaria de Planejamento vai participar de todas as fases."),
  ],
  "etapa-pd-docs-demo": [
    m("bruno", "2026-07-06T10:00:00-03:00", "Para o Plano Diretor precisamos da base cartográfica atualizada, da legislação urbanística vigente e do PPA. Tudo está no checklist da etapa."),
    m("marina", "2026-07-08T16:40:00-03:00", "Recebido. A base cartográfica está com o setor de geoprocessamento; enviamos o restante ainda hoje."),
    m("marina", "2026-07-14T09:15:00-03:00", "Enviamos os cinco itens. O arquivo vetorial completo foi por e-mail devido ao tamanho; aqui está o memorial com os metadados."),
    m("bruno", "2026-07-16T14:00:00-03:00", "Tudo validado. Documentos iniciais concluídos."),
  ],
  "etapa-pd-fase1-demo": [
    m("bruno", "2026-08-21T15:00:00-03:00", "Marina, disponibilizamos a versão 1 da Fase 01 (Diagnóstico) para revisão do município. São três seções: diagnóstico territorial, zoneamento e mobilidade.", undefined, "cmu4k7ycp0003kmrqj5xbjnlb"),
    m("bruno", "2026-08-21T15:02:00-03:00", "Lembrando que o documento pode ser grifado e comentado por trecho; qualquer dúvida sobre a ferramenta é só falar por aqui.", undefined, "cmu4k87ad0005kmrqmllj35b5"),
    m("marina", "2026-08-28T17:10:00-03:00", "Bruno, revisamos a v1. Deixamos comentários nas três seções e reprovamos o documento nesta versão: faltam os dados do último censo e é preciso detalhar o zoneamento."),
    m("bruno", "2026-09-01T09:30:00-03:00", "Obrigado pelo retorno detalhado. Vamos incorporar tudo e ampliar o diagnóstico com habitação de interesse social e meio ambiente."),
    m("ana", "2026-09-04T10:20:00-03:00", "Alinhamento: a v2 sai até 17/09. Marina, alguma outra secretaria precisa participar da validação do zoneamento?"),
    m("marina", "2026-09-04T14:45:00-03:00", "Sim, Planejamento e Procuradoria. Elas vão comentar diretamente no documento."),
    m("bruno", "2026-09-17T18:00:00-03:00", "Versão 2 publicada! Seis seções, agora com habitação de interesse social e meio ambiente. Peço atenção especial às seções de zoneamento e diretrizes de mobilidade."),
    m("marina", "2026-09-18T11:30:00-03:00", "Recebida. Já estamos comentando. A Procuradoria tem ressalvas sobre o coeficiente de aproveitamento único."),
    m("bruno", "2026-09-19T15:40:00-03:00", "Respondi os trechos já esclarecidos e marquei como resolvidos. Os demais aguardam retorno de vocês."),
    m("marina", "2026-09-20T10:30:00-03:00", "Perfeito. Enviamos a listagem oficial das ZEIS e os dados das nascentes até sexta-feira."),
  ],

  // ─────────────── Guarapuava — Plano de Mobilidade (PRJ-2026-025) ───────────────
  cmu4ut0jr0017hby3toavr3eo: [
    m("ana", "2026-08-06T09:00:00-03:00", "Marina, o projeto do Plano de Mobilidade Urbana está aberto. Este plano dialoga com o Plano Diretor em andamento, então vamos compartilhar bases de dados entre as equipes."),
    m("marina", "2026-08-06T11:30:00-03:00", "Ótimo, isso evita retrabalho. Podemos usar a base de contagens que a Diretoria de Trânsito já possui."),
    m("ana", "2026-08-07T08:45:00-03:00", "Perfeito. Peça à Diretoria que envie o contato do responsável para alinharmos as pesquisas de campo."),
  ],
  cmu4ut0jr0018hby3if7urgkn: [
    m("bruno", "2026-09-15T10:00:00-03:00", "Publicamos a versão 1 do Diagnóstico de Mobilidade, com quatro seções. Peço a revisão do município, com grifos nos pontos que precisam de ajuste."),
    m("marina", "2026-09-19T10:40:00-03:00", "Comentários em andamento. Vou incluir dados da autarquia de trânsito nos próximos dias."),
    m("ana", "2026-09-19T14:20:00-03:00", "Respondi os pontos metodológicos diretamente nos trechos grifados."),
    m("marina", "2026-09-20T10:10:00-03:00", "Vamos enviar a planilha do subsídio e a de atropelamentos na segunda-feira."),
  ],

  // ─────────────── Mariópolis — Estatuto e PCCS (PRJ-2026-031) ───────────────
  "etapa-mar-info": [
    m("ana", "2026-07-27T09:00:00-03:00", "Helena, seja bem-vinda à plataforma! O contrato foi assinado e o projeto do Estatuto e PCCS de Mariópolis já está aberto. Aqui você acompanha etapas, prazos e conversa com nossa equipe."),
    m("helena", "2026-07-27T10:20:00-03:00", "Obrigada, Ana! Já consegui acessar. Fizemos a reunião com o Prefeito e há grande expectativa com o projeto."),
    m("ana", "2026-08-03T08:30:00-03:00", "Kick-off realizado por videoconferência hoje cedo. Os próximos passos estão na etapa de documentos iniciais."),
  ],
  "etapa-mar-docs": [
    m("bruno", "2026-08-03T09:30:00-03:00", "Helena, bom dia! Abrimos a etapa de documentos iniciais. Os itens estão no checklist e o formulário do município precisa ser respondido por você."),
    m("helena", "2026-08-03T14:10:00-03:00", "Bom dia, Bruno! Já vi o formulário. Vou reunir as informações com o RH e a contabilidade."),
    m("helena", "2026-08-10T16:20:00-03:00", "Formulário respondido e Lei Orgânica anexada. Fiquei com uma dúvida sobre a relação completa de cargos: precisa incluir os temporários?"),
    m("bruno", "2026-08-11T09:00:00-03:00", "Ótima pergunta. Inclua os temporários em uma aba separada, com a data de término de cada contrato."),
    m("rogerio", "2026-08-18T11:45:00-03:00", "Bom dia. Sou o Rogério, assessor jurídico. Estou revisando a legislação complementar e o regime jurídico de 2009 foi alterado duas vezes. Vou enviar todas as versões consolidadas."),
    m("carla", "2026-08-18T15:00:00-03:00", "Ótimo, Rogério! As versões consolidadas ajudam muito na análise do Estatuto."),
    m("helena", "2026-08-25T10:00:00-03:00", "Organograma anexado. A Prefeitura reestruturou as secretarias em julho, então o documento já reflete a nova estrutura."),
    m("bruno", "2026-09-02T14:20:00-03:00", "Organograma e Lei Orgânica aprovados. Já recebemos a relação de cargos e estamos validando; faltam a folha de pagamento e a legislação complementar."),
    m("helena", "2026-09-15T09:50:00-03:00", "Enviei a folha de pagamento dos últimos 12 meses. O RH pede desculpas pelo atraso, fechamos a competência de agosto só agora."),
    m("bruno", "2026-09-19T16:30:00-03:00", "Recebido, Helena! O prazo da etapa é 24/09. Precisamos apenas da legislação complementar consolidada para concluir."),
    m("rogerio", "2026-09-21T08:40:00-03:00", "Bom dia! Envio hoje a consolidação da legislação. Devo terminar até o meio-dia."),
  ],

  // ─────────────── Pato Branco — Plano Diretor (PRJ-2026-032) ───────────────
  "etapa-pb-info": [
    m("ana", "2026-06-22T09:30:00-03:00", "Juliana, o projeto do Plano Diretor de Pato Branco está aberto na plataforma. O cronograma geral já está cadastrado."),
    m("juliana", "2026-06-22T11:00:00-03:00", "Recebemos, Ana. O Prefeito quer apresentar o cronograma ao Conselho da Cidade no início de julho."),
  ],
  "etapa-pb-docs": [
    m("bruno", "2026-06-29T10:00:00-03:00", "Juliana, precisamos dos documentos iniciais do Plano Diretor: legislação urbanística, PPA, base cartográfica e relatório de infraestrutura."),
    m("juliana", "2026-07-06T15:20:00-03:00", "Enviamos a base cartográfica e a legislação. O relatório de infraestrutura sai amanhã."),
    m("juliana", "2026-07-15T09:40:00-03:00", "Todos os itens enviados e formulário respondido."),
    m("bruno", "2026-07-23T14:00:00-03:00", "Documentação validada. Etapa concluída, seguimos para a Fase 01."),
  ],
  "etapa-pb-fase1": [
    m("bruno", "2026-09-14T16:00:00-03:00", "Juliana, a versão 1 da Fase 01 do Plano Diretor de Pato Branco está disponível para revisão (5 seções)."),
    m("juliana", "2026-09-15T08:50:00-03:00", "Recebido! Vou distribuir para Planejamento, Obras e Procuradoria. Todos podem comentar diretamente no documento?"),
    m("bruno", "2026-09-15T09:10:00-03:00", "Sim, cada usuário do município consegue grifar e comentar. Peço que sinalizem no chat quando terminarem."),
    m("ricardo", "2026-09-16T11:55:00-03:00", "Bom dia. Registrei duas ressalvas jurídicas nas seções 2 e 5. Em especial, evitar a expressão “ocupação irregular”."),
    m("ana", "2026-09-17T09:40:00-03:00", "Ricardo, ajustaremos a redação para “ocupações em áreas de risco”, mantendo o rigor técnico. Obrigada."),
    m("juliana", "2026-09-17T16:25:00-03:00", "Sobre a ampliação do perímetro urbano: precisamos de justificativa técnica reforçada, o Conselho da Cidade se reúne dia 24/09."),
    m("bruno", "2026-09-18T10:20:00-03:00", "Vamos preparar uma nota técnica com a análise de vazios urbanos e a demanda projetada por lotes. Envio até 23/09.", {
      nome: "Nota_Tecnica_Perimetro_Urbano_Pato_Branco.pdf",
      titulo: "Nota técnica — ampliação do perímetro urbano de Pato Branco (minuta)",
      paragrafos: [
        "Objetivo: subsidiar a discussão no Conselho da Cidade sobre a ampliação de 4,2 km² do perímetro urbano ao norte do município.",
        "Vazios urbanos: 8,7% dos 41.260 lotes urbanos estão vazios (3.590 lotes) e 3,1% subutilizados (1.279 lotes).",
        "Demanda projetada: crescimento de 1,2% a.a. implica demanda de aproximadamente 4.100 novos lotes até 2036.",
        "Conclusão preliminar: a ocupação dos vazios existentes atenderia a 88% da demanda projetada; a ampliação deve ser condicionada e faseada.",
      ],
    }),
    m("juliana", "2026-09-18T10:45:00-03:00", "Perfeito, encaminharei ao Conselho antes da reunião."),
    m("ana", "2026-09-19T14:00:00-03:00", "Lembrete: o prazo da etapa é 02/10. Idealmente fechamos os comentários até 28/09 para gerar a versão 2 a tempo."),
  ],

  // ─────────────── Coronel Vivida — Personalizado (PRJ-2026-033) ───────────────
  "etapa-cv-info": [
    m("ana", "2026-08-06T09:00:00-03:00", "Tatiane, o projeto do Plano Municipal de Habitação de Interesse Social está aberto. O fluxo é enxuto: informações, documentos e a Fase 01 de levantamento."),
    m("tatiane", "2026-08-06T13:30:00-03:00", "Ótimo, Ana. Já estamos organizando a equipe da Secretaria de Obras para apoiar."),
  ],
  "etapa-cv-docs": [
    m("bruno", "2026-08-10T10:00:00-03:00", "Tatiane, precisamos do cadastro habitacional existente, do Plano Diretor vigente e do mapa dos bairros prioritários."),
    m("tatiane", "2026-08-21T16:10:00-03:00", "Documentos enviados e formulário respondido."),
    m("bruno", "2026-08-25T09:30:00-03:00", "Validado. Iniciamos a Fase 01 na próxima semana."),
  ],
  "etapa-cv-fase1": [
    m("bruno", "2026-09-01T08:30:00-03:00", "Tatiane, iniciamos a Fase 01 com o levantamento de campo nos seis bairros prioritários. Equipe em campo de 08 a 19/09."),
    m("tatiane", "2026-09-01T10:00:00-03:00", "Ótimo. A Secretaria de Obras disponibiliza dois agentes para acompanhar as visitas."),
    m("bruno", "2026-09-11T17:30:00-03:00", "Parcial da campanha: 312 domicílios vistoriados em 4 bairros. Segue a planilha preliminar.", {
      nome: "Levantamento_Parcial_Bairros.pdf",
      titulo: "Levantamento habitacional — resultados parciais",
      paragrafos: [
        "Bairros vistoriados até 11/09: Centro Sul, Vila Nova, São Cristóvão e Jardim Primavera.",
        "Domicílios vistoriados: 312. Em situação precária: 47 (15,1%). Sem infraestrutura de esgoto: 88 (28,2%).",
        "Domicílios em áreas de risco: 19, concentrados no Jardim Primavera (margem de córrego).",
        "Próximos passos: concluir os bairros Alto da Colina e Rio Bonito e consolidar o cadastro.",
      ],
    }),
    m("tatiane", "2026-09-14T10:15:00-03:00", "Recebido. Podemos incluir também o bairro Santa Rita, que foi cadastrado recentemente?"),
    m("bruno", "2026-09-14T11:00:00-03:00", "Podemos sim. Estenderemos a campanha até 24/09."),
    m("ana", "2026-09-18T15:45:00-03:00", "Tatiane, ajustamos o prazo da etapa para 16/10 por causa da inclusão do bairro."),
  ],
};
