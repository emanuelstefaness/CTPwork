import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Gerador mínimo de PDF (Helvetica, A4) sem dependências — usado só para que os documentos do
// seed de demonstração sejam arquivos reais, abríveis em /api/files/[id].

export type Bloco = { estilo: "titulo" | "subtitulo" | "texto" | "item" | "nota"; texto: string };

const ESPECIAIS: Record<string, number> = { "—": 0x97, "–": 0x96, "“": 0x93, "”": 0x94, "’": 0x92, "‘": 0x91, "•": 0x95, "…": 0x85 };

function winAnsi(s: string): Buffer {
  const bytes: number[] = [];
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ESPECIAIS[ch] !== undefined) bytes.push(ESPECIAIS[ch]);
    else if (code < 256) bytes.push(code);
    else bytes.push(0x3f);
  }
  return Buffer.from(bytes);
}

function escapar(b: Buffer): Buffer {
  const out: number[] = [];
  for (const byte of b) {
    if (byte === 0x5c || byte === 0x28 || byte === 0x29) out.push(0x5c);
    out.push(byte);
  }
  return Buffer.from(out);
}

function quebrar(texto: string, max: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(" ")) {
      if ((atual + " " + palavra).trim().length > max) {
        linhas.push(atual);
        atual = palavra;
      } else atual = (atual + " " + palavra).trim();
    }
    linhas.push(atual);
  }
  return linhas;
}

type Linha = { x: number; y: number; fonte: "F1" | "F2" | "F3"; tam: number; texto: string };

export function gerarPdf(rodape: string, blocos: Bloco[]): Buffer {
  const paginas: Linha[][] = [[]];
  let y = 790;
  const nova = () => {
    paginas.push([]);
    y = 790;
  };
  const estilos = {
    titulo: { fonte: "F2" as const, tam: 17, lead: 24, espacoAntes: 0, max: 54, x: 56 },
    subtitulo: { fonte: "F2" as const, tam: 12.5, lead: 18, espacoAntes: 12, max: 70, x: 56 },
    texto: { fonte: "F1" as const, tam: 10.5, lead: 15, espacoAntes: 4, max: 88, x: 56 },
    item: { fonte: "F1" as const, tam: 10.5, lead: 15, espacoAntes: 2, max: 82, x: 72 },
    nota: { fonte: "F3" as const, tam: 9, lead: 13, espacoAntes: 6, max: 100, x: 56 },
  };
  for (const bloco of blocos) {
    const e = estilos[bloco.estilo];
    const texto = bloco.estilo === "item" ? `•  ${bloco.texto}` : bloco.texto;
    const linhas = quebrar(texto, e.max);
    y -= e.espacoAntes;
    if (y - e.lead * Math.min(linhas.length, 3) < 70) nova();
    for (const l of linhas) {
      if (y < 70) nova();
      paginas[paginas.length - 1].push({ x: e.x, y, fonte: e.fonte, tam: e.tam, texto: l });
      y -= e.lead;
    }
  }

  const objetos: Buffer[] = [];
  const ref = (n: number) => `${n} 0 R`;
  const totalPaginas = paginas.length;
  // 1 catalog, 2 pages, 3..5 fontes, depois (página, conteúdo) por página
  const idsPagina = paginas.map((_, i) => 6 + i * 2);
  objetos.push(Buffer.from(`<< /Type /Catalog /Pages 2 0 R >>`));
  objetos.push(Buffer.from(`<< /Type /Pages /Kids [${idsPagina.map(ref).join(" ")}] /Count ${totalPaginas} >>`));
  objetos.push(Buffer.from(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`));
  objetos.push(Buffer.from(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`));
  objetos.push(Buffer.from(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>`));

  paginas.forEach((linhas, i) => {
    const partes: Buffer[] = [];
    partes.push(Buffer.from("0.03 0.52 0.70 rg 56 812 60 3 re f\n"));
    for (const l of linhas) {
      partes.push(Buffer.from(`BT /${l.fonte} ${l.tam} Tf ${l.x} ${l.y} Td (`));
      partes.push(escapar(winAnsi(l.texto)));
      partes.push(Buffer.from(") Tj ET\n"));
    }
    partes.push(Buffer.from(`0.55 0.6 0.66 rg BT /F1 8 Tf 56 36 Td (`));
    partes.push(escapar(winAnsi(`${rodape}  ·  página ${i + 1} de ${totalPaginas}`)));
    partes.push(Buffer.from(") Tj ET\n"));
    const conteudo = Buffer.concat(partes);
    objetos.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${idsPagina[i] + 1} 0 R >>`));
    objetos.push(Buffer.concat([Buffer.from(`<< /Length ${conteudo.length} >>\nstream\n`), conteudo, Buffer.from("\nendstream")]));
  });

  const saida: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets: number[] = [];
  let pos = saida[0].length;
  objetos.forEach((obj, i) => {
    offsets.push(pos);
    const pedaco = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), obj, Buffer.from("\nendobj\n")]);
    saida.push(pedaco);
    pos += pedaco.length;
  });
  let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += `${String(o).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  saida.push(Buffer.from(xref));
  return Buffer.concat(saida);
}

const PASTA = path.join(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"), "uploads");

/**
 * Grava o PDF em storage/uploads/<anexoId> — ou no Vercel Blob, quando a demonstração é semeada na
 * publicação (mesmo caminho de src/lib/arquivos.ts) — e devolve o tamanho em bytes.
 */
export async function gravarPdf(anexoId: string, rodape: string, blocos: Bloco[]): Promise<number> {
  const buffer = gerarPdf(rodape, blocos);
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    const { put } = await import("@vercel/blob");
    await put(`uploads/${anexoId}`, buffer, { access: "private", contentType: "application/pdf", addRandomSuffix: false, allowOverwrite: true });
    return buffer.length;
  }
  await mkdir(PASTA, { recursive: true });
  await writeFile(path.join(PASTA, anexoId), buffer);
  return buffer.length;
}
