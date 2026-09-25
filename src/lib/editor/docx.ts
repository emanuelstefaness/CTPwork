import {
  AlignmentType, BorderStyle, CommentRangeEnd, CommentRangeStart, CommentReference, Document, HeadingLevel,
  HighlightColor, LevelFormat, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
  type ICommentOptions, type ParagraphChild,
} from "docx";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import { TIPO_ANOTACAO_LABEL, type TipoAnotacao } from "./extensoes";

/**
 * Exporta uma versão do documento para .docx. Grifos viram marca-texto do Word e comentários,
 * concordo/discordo viram comentários nativos do Word (balão na margem), com as respostas como
 * comentários encadeados — quem abre no Word vê a revisão exatamente como no sistema.
 */

export type AnotacaoExport = {
  de: number;
  ate: number;
  tipo: TipoAnotacao;
  cor: string | null;
  texto: string | null;
  sugestao?: string | null;
  decisao?: string | null;
  autor: string;
  criadoEm: Date;
  resolvido: boolean;
  respostas: { autor: string; texto: string; criadoEm: Date }[];
};

const GRIFO_WORD: Record<string, (typeof HighlightColor)[keyof typeof HighlightColor]> = {
  amarelo: HighlightColor.YELLOW,
  verde: HighlightColor.GREEN,
  azul: HighlightColor.CYAN,
  rosa: HighlightColor.MAGENTA,
};

function highlightDoHex(hex: string | undefined) {
  const h = (hex ?? "").toLowerCase();
  if (h.includes("bbf7") || h.includes("green")) return HighlightColor.GREEN;
  if (h.includes("bfdb") || h.includes("blue") || h.includes("cyan")) return HighlightColor.CYAN;
  if (h.includes("fbcf") || h.includes("pink") || h.includes("magenta")) return HighlightColor.MAGENTA;
  return HighlightColor.YELLOW;
}

const iniciais = (nome: string) => nome.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const ALINHAMENTO: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

export async function gerarDocx(params: {
  doc: PMNode;
  titulo: string;
  subtitulo: string;
  anotacoes: AnotacaoExport[];
}): Promise<Buffer> {
  const { doc, titulo, subtitulo } = params;
  const validas = params.anotacoes.filter((a) => a.ate > a.de && a.ate <= doc.content.size);
  const grifos = validas.filter((a) => a.tipo === "GRIFO" && !a.texto);
  const comComentario = validas.filter((a) => !(a.tipo === "GRIFO" && !a.texto));

  // Cada apontamento com texto vira um comentário do Word; respostas encadeadas via parentId.
  const comentarios: ICommentOptions[] = [];
  const idDe = new Map<AnotacaoExport, number>();
  let proximoId = 0;
  for (const a of comComentario) {
    const id = proximoId++;
    idDe.set(a, id);
    const rotulo = a.tipo === "GRIFO" ? "Grifo" : TIPO_ANOTACAO_LABEL[a.tipo];
    comentarios.push({
      id,
      author: a.autor,
      initials: iniciais(a.autor),
      date: a.criadoEm,
      resolved: a.resolvido,
      children:
        a.tipo === "SUGESTAO"
          ? [
              new Paragraph({
                children: [
                  new TextRun({ text: `[${rotulo}${a.decisao === "ACEITA" ? " — aceita" : a.decisao === "RECUSADA" ? " — não aceita" : ""}] `, bold: true }),
                  new TextRun(a.sugestao ? "Substituir por: " : "Suprimir o trecho."),
                  ...(a.sugestao ? [new TextRun({ text: `“${a.sugestao}”`, italics: true })] : []),
                ],
              }),
              ...(a.texto ? [new Paragraph({ children: [new TextRun({ text: "Justificativa: ", bold: true }), new TextRun(a.texto)] })] : []),
            ]
          : [new Paragraph({ children: [new TextRun({ text: `[${rotulo}] `, bold: true }), new TextRun(a.texto ?? "")] })],
    });
    for (const r of a.respostas) {
      comentarios.push({ id: proximoId++, parentId: id, author: r.autor, initials: iniciais(r.autor), date: r.criadoEm, children: [new Paragraph(r.texto)] });
    }
  }

  const abertos = new Set<AnotacaoExport>();
  const fechados = new Set<AnotacaoExport>();
  let instanciaLista = 0;

  function runsDoBloco(bloco: PMNode, posInicio: number): ParagraphChild[] {
    const filhos: ParagraphChild[] = [];
    bloco.forEach((no, offset) => {
      const inicio = posInicio + 1 + offset;
      if (no.type.name === "hardBreak") {
        filhos.push(new TextRun({ text: "", break: 1 }));
        return;
      }
      if (!no.isText || !no.text) return;
      const fim = inicio + no.text.length;
      // Fronteiras de anotação dentro deste pedaço de texto.
      const cortes = new Set<number>([inicio, fim]);
      for (const a of validas) {
        if (a.de > inicio && a.de < fim) cortes.add(a.de);
        if (a.ate > inicio && a.ate < fim) cortes.add(a.ate);
      }
      const pontos = [...cortes].sort((x, y) => x - y);
      for (let i = 0; i < pontos.length - 1; i++) {
        const [a, b] = [pontos[i], pontos[i + 1]];
        for (const an of comComentario) {
          if (!abertos.has(an) && an.de <= a && an.ate > a) {
            abertos.add(an);
            filhos.push(new CommentRangeStart(idDe.get(an)!));
          }
        }
        const grifo = grifos.find((g) => g.de <= a && g.ate >= b);
        const marcas = no.marks;
        const tem = (nome: string) => marcas.some((m: Mark) => m.type.name === nome);
        const marcaGrifo = marcas.find((m: Mark) => m.type.name === "highlight");
        filhos.push(
          new TextRun({
            text: no.text.slice(a - inicio, b - inicio),
            bold: tem("bold") || undefined,
            italics: tem("italic") || undefined,
            underline: tem("underline") ? {} : undefined,
            strike: tem("strike") || undefined,
            highlight: grifo ? GRIFO_WORD[grifo.cor ?? "amarelo"] : marcaGrifo ? highlightDoHex(marcaGrifo.attrs.color as string) : undefined,
          }),
        );
        for (const an of comComentario) {
          if (abertos.has(an) && !fechados.has(an) && an.ate <= b) {
            fechados.add(an);
            filhos.push(new CommentRangeEnd(idDe.get(an)!), new TextRun({ children: [new CommentReference(idDe.get(an)!)] }));
          }
        }
      }
    });
    return filhos;
  }

  function blocos(no: PMNode, pos: number, ctx: { lista?: { tipo: "bullet" | "numerada"; nivel: number; instancia: number }; citacao?: boolean } = {}): (Paragraph | Table)[] {
    const saida: (Paragraph | Table)[] = [];
    no.forEach((filho, offset) => {
      const p = pos + offset + (no.type.name === "doc" ? 0 : 1);
      const nome = filho.type.name;
      const alinhamento = ALINHAMENTO[(filho.attrs.textAlign as string) ?? ""];
      if (nome === "paragraph" || nome === "heading") {
        const nivel = filho.attrs.level as number;
        saida.push(
          new Paragraph({
            children: runsDoBloco(filho, p),
            heading: nome === "heading" ? (nivel === 1 ? HeadingLevel.HEADING_1 : nivel === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3) : undefined,
            alignment: alinhamento,
            indent: ctx.citacao ? { left: 720 } : undefined,
            bullet: ctx.lista?.tipo === "bullet" ? { level: ctx.lista.nivel } : undefined,
            numbering: ctx.lista?.tipo === "numerada" ? { reference: "numerada", level: ctx.lista.nivel, instance: ctx.lista.instancia } : undefined,
            spacing: { after: 120 },
          }),
        );
      } else if (nome === "bulletList" || nome === "orderedList") {
        const nivel = ctx.lista ? ctx.lista.nivel + 1 : 0;
        const lista = { tipo: nome === "bulletList" ? ("bullet" as const) : ("numerada" as const), nivel, instancia: nome === "orderedList" ? ++instanciaLista : 0 };
        filho.forEach((item, off) => saida.push(...blocos(item, p + 1 + off, { ...ctx, lista })));
      } else if (nome === "blockquote") {
        saida.push(...blocos(filho, p, { ...ctx, citacao: true }));
      } else if (nome === "horizontalRule") {
        saida.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } } }));
      } else if (nome === "table") {
        const linhas: TableRow[] = [];
        filho.forEach((linha, offLinha) => {
          const pLinha = p + 1 + offLinha;
          const celulas: TableCell[] = [];
          linha.forEach((celula, offCel) => {
            const conteudo = blocos(celula, pLinha + 1 + offCel).filter((b): b is Paragraph => b instanceof Paragraph);
            celulas.push(new TableCell({ children: conteudo.length ? conteudo : [new Paragraph("")], shading: celula.type.name === "tableHeader" ? { fill: "F1F5F9" } : undefined }));
          });
          linhas.push(new TableRow({ children: celulas }));
        });
        saida.push(new Table({ rows: linhas, width: { size: 100, type: WidthType.PERCENTAGE } }));
      } else {
        saida.push(...blocos(filho, p, ctx));
      }
    });
    return saida;
  }

  const corpo = blocos(params.doc, 0);
  // Comentário cujo fim caiu fora de um trecho de texto: fecha no último parágrafo.
  const pendentes = comComentario.filter((a) => abertos.has(a) && !fechados.has(a));
  if (pendentes.length) {
    corpo.push(new Paragraph({ children: pendentes.flatMap((a) => [new CommentRangeEnd(idDe.get(a)!), new TextRun({ children: [new CommentReference(idDe.get(a)!)] })]) }));
  }

  const documento = new Document({
    creator: "CTP Work",
    title: titulo,
    styles: { default: { document: { run: { font: "Calibri", size: 23 } } } },
    comments: { children: comentarios },
    numbering: {
      config: [
        {
          reference: "numerada",
          levels: [0, 1, 2, 3].map((level) => ({
            level,
            format: level % 2 === 0 ? LevelFormat.DECIMAL : LevelFormat.LOWER_LETTER,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun(titulo)] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: subtitulo, color: "64748B", size: 18 })] }),
          ...corpo,
        ],
      },
    ],
  });
  return Packer.toBuffer(documento);
}
