import type { PrismaClient } from "@prisma/client";
import { Node as PMNode } from "@tiptap/pm/model";
import { schemaDocumento } from "../../src/lib/editor/servidor";
import { localizarTrecho, textoDoTrecho } from "../../src/lib/editor/ancoras";

/**
 * Revisão da minuta do Estatuto e PCCS de Guarapuava como acontece de verdade, versão a versão:
 *   v1 — o município sugere nova redação; o CTP aceita (o texto novo aparece na v2).
 *   v2 — o município sugere reduzir o interstício da promoção; o CTP recusa, com a justificativa.
 *   v3 (a atual, aguardando o município) — grifos coloridos do município e do CTP e duas sugestões
 *        ainda sem decisão do CTP.
 * Roda depois de seed-demo (que cria as versões e já converte os documentos para o editor).
 * Ids fixos: rodar de novo atualiza em vez de duplicar.
 */

const d = (iso: string) => new Date(iso);

type Anotacao = {
  id: string;
  autor: string;
  trecho: string;
  tipo: "GRIFO" | "COMENTARIO" | "SUGESTAO";
  quando: string;
  cor?: "amarelo" | "verde" | "azul" | "rosa";
  texto?: string;
  sugestao?: string;
  /** Só SUGESTAO: decisão do CTP (sem ela, a sugestão fica aguardando). */
  decisao?: { valor: "ACEITA" | "RECUSADA"; por: string; quando: string; motivo?: string };
  /** Conversa no apontamento (além do motivo da recusa). */
  respostas?: { autor: string; quando: string; texto: string }[];
};

export async function semearRevisaoDaMinuta(prisma: PrismaClient, ctp: { ana: string; bruno: string; carla: string }) {
  const marina = (await prisma.user.findUniqueOrThrow({ where: { email: "marina.kowalski@guarapuava.pr.gov.br" } })).id;

  const porDocumento: Record<string, Anotacao[]> = {
    "documento-pccs-guarapuava-v1": [
      {
        id: "proc-v1-sug-vedacao", autor: marina, tipo: "SUGESTAO", quando: "2026-08-22T10:15:00-03:00",
        trecho: "sem previsão expressa de vedação a cargos em comissão de natureza técnica",
        sugestao: "ficando vedada a criação de cargos em comissão para atribuições técnicas permanentes",
        texto: "O Ministério Público recomendou ao Município evitar comissionados em funções técnicas.",
        decisao: { valor: "ACEITA", por: ctp.bruno, quando: "2026-08-28T15:40:00-03:00" },
      },
      {
        id: "proc-v1-sug-intersticio", autor: marina, tipo: "SUGESTAO", quando: "2026-08-22T10:32:00-03:00",
        trecho: "a cada 36 meses",
        sugestao: "a cada 24 meses",
        texto: "36 meses desestimula a carreira; os municípios vizinhos usam 24.",
        decisao: { valor: "ACEITA", por: ctp.bruno, quando: "2026-08-28T15:41:00-03:00" },
      },
    ],
    "documento-pccs-guarapuava-v2": [
      {
        id: "proc-v2-grifo-promocao", autor: marina, tipo: "GRIFO", cor: "amarelo", quando: "2026-09-05T09:10:00-03:00",
        trecho: "interstício mínimo de 5 anos na classe anterior",
      },
      {
        id: "proc-v2-sug-promocao", autor: marina, tipo: "SUGESTAO", quando: "2026-09-05T09:14:00-03:00",
        trecho: "interstício mínimo de 5 anos",
        sugestao: "interstício mínimo de 3 anos",
        texto: "Com 5 anos, um servidor só chega ao topo da carreira perto da aposentadoria.",
        decisao: {
          valor: "RECUSADA", por: ctp.carla, quando: "2026-09-10T11:20:00-03:00",
          motivo: "Mantivemos 5 anos: a promoção muda de classe (e não só de referência), e o impacto na folha com 3 anos ultrapassaria o limite prudencial da LRF já em 2028, pela projeção que a Fazenda nos enviou. Em compensação, a v3 reduz a progressão para 24 meses.",
        },
        respostas: [{ autor: marina, quando: "2026-09-11T08:30:00-03:00", texto: "Entendido, faz sentido com a projeção da Fazenda. De acordo." }],
      },
    ],
    "documento-minuta-demo": [
      {
        id: "proc-v3-grifo-titulacao", autor: marina, tipo: "GRIFO", cor: "rosa", quando: "2026-09-15T14:02:00-03:00",
        trecho: "5% (especialização), 10% (mestrado) ou 15% (doutorado)",
        texto: "Percentuais acima do que a Fazenda consegue pagar.",
      },
      {
        id: "proc-v3-grifo-posse", autor: marina, tipo: "GRIFO", cor: "amarelo", quando: "2026-09-15T14:06:00-03:00",
        trecho: "aptidão física e mental",
      },
      {
        id: "proc-v3-grifo-lrf", autor: ctp.carla, tipo: "GRIFO", cor: "verde", quando: "2026-09-12T10:00:00-03:00",
        trecho: "limite de despesa com pessoal",
        texto: "Ponto de atenção jurídica: manter vinculado à LRF em todas as versões.",
      },
      {
        id: "proc-v3-grifo-jornada", autor: ctp.ana, tipo: "GRIFO", cor: "azul", quando: "2026-09-12T10:05:00-03:00",
        trecho: "40 (quarenta) horas semanais",
      },
      {
        id: "proc-v3-sug-recurso", autor: marina, tipo: "SUGESTAO", quando: "2026-09-15T14:20:00-03:00",
        trecho: "10 (dez) dias",
        sugestao: "15 (quinze) dias",
        texto: "O Estatuto atual dá 15 dias para recurso; reduzir pode gerar questionamento do sindicato.",
      },
      {
        id: "proc-v3-sug-enquadramento", autor: marina, tipo: "SUGESTAO", quando: "2026-09-15T14:28:00-03:00",
        trecho: "180 (cento e oitenta) dias",
        sugestao: "120 (cento e vinte) dias",
        texto: "A comissão já está formada; 120 dias são suficientes e antecipam o impacto financeiro para este exercício.",
      },
      {
        id: "proc-v3-com-concurso", autor: ctp.bruno, tipo: "COMENTARIO", quando: "2026-09-12T16:40:00-03:00",
        trecho: "concurso público de provas ou de provas e títulos",
        texto: "Marina, a Secretaria de Saúde confirmou se quer prova de títulos para todos os cargos de nível superior?",
        respostas: [
          { autor: marina, quando: "2026-09-15T13:55:00-03:00", texto: "Confirmou: títulos para nível superior; só provas para os demais." },
          { autor: ctp.bruno, quando: "2026-09-15T16:10:00-03:00", texto: "Perfeito, vamos detalhar no Anexo II na próxima versão." },
        ],
      },
    ],
  };

  let total = 0;
  for (const [documentoId, anotacoes] of Object.entries(porDocumento)) {
    const documento = await prisma.documentoVersionado.findUnique({ where: { id: documentoId } });
    if (!documento?.conteudo) continue;
    const doc = PMNode.fromJSON(schemaDocumento, JSON.parse(documento.conteudo));
    // O município precisa ter aberto a versão para poder grifar e sugerir.
    const abriu = anotacoes.filter((a) => a.autor === marina).map((a) => a.quando).sort()[0];
    if (abriu) {
      const quando = new Date(d(abriu).getTime() - 20 * 60_000);
      await prisma.visualizacaoDocumento.upsert({
        where: { documentoId_userId: { documentoId, userId: marina } },
        update: {},
        create: { documentoId, userId: marina, visualizadoEm: quando },
      });
    }
    for (const a of anotacoes) {
      const pos = localizarTrecho(doc, a.trecho);
      if (!pos) throw new Error(`Trecho não encontrado em ${documentoId}: "${a.trecho}"`);
      const resolvido = !!a.decisao;
      const dados = {
        documentoId, autorId: a.autor, de: pos.de, ate: pos.ate, trecho: textoDoTrecho(doc, pos.de, pos.ate),
        tipo: a.tipo, cor: a.cor ?? null, texto: a.texto ?? null, sugestao: a.sugestao ?? null,
        decisao: a.decisao?.valor ?? null, resolvido,
        resolvidoPorId: a.decisao?.por ?? null, resolvidoEm: a.decisao ? d(a.decisao.quando) : null,
        createdAt: d(a.quando),
      };
      await prisma.anotacaoDocumento.upsert({ where: { id: a.id }, update: dados, create: { id: a.id, ...dados } });
      const respostas = [
        ...(a.decisao?.motivo ? [{ autor: a.decisao.por, quando: a.decisao.quando, texto: a.decisao.motivo }] : []),
        ...(a.respostas ?? []),
      ];
      for (const [i, r] of respostas.entries()) {
        const id = `${a.id}-r${i + 1}`;
        const resposta = { anotacaoId: a.id, autorId: r.autor, texto: r.texto, createdAt: d(r.quando) };
        await prisma.respostaAnotacao.upsert({ where: { id }, update: resposta, create: { id, ...resposta } });
      }
      total++;
    }
  }

  // Conversa da etapa de documentos de Mariópolis: o CTP não aceita um arquivo e pede de novo.
  const mariopolis = await prisma.etapaProjeto.findUnique({ where: { id: "etapa-mar-docs" } });
  if (mariopolis) {
    const helena = (await prisma.user.findUniqueOrThrow({ where: { email: "helena.bittencourt@mariopolis.pr.gov.br" } })).id;
    const mensagens = [
      { autor: ctp.bruno, quando: "2026-09-12T10:20:00-03:00", texto: "Helena, a folha de pagamento veio só com os últimos 6 meses (mar–ago). Para o estudo de impacto precisamos dos 12 meses. Consegue reenviar no item do checklist?" },
      { autor: helena, quando: "2026-09-12T15:45:00-03:00", texto: "Peço ao RH hoje. A relação de cargos está correta?" },
      { autor: ctp.bruno, quando: "2026-09-13T09:05:00-03:00", texto: "Está quase: faltam os cargos extintos que ainda têm ocupantes. Pode incluir no mesmo arquivo." },
    ];
    for (const [i, m] of mensagens.entries()) {
      const id = `proc-chat-mar-${i + 1}`;
      const dados = { etapaId: mariopolis.id, autorId: m.autor, texto: m.texto, createdAt: d(m.quando) };
      await prisma.mensagemChat.upsert({ where: { id }, update: dados, create: { id, ...dados } });
    }
  }

  return total;
}
