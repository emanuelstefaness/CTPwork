import { prisma } from "@/lib/prisma";
import { gravarArquivo } from "@/lib/arquivos";
import { limiteAnexoBytes } from "@/lib/limite-anexo";

/**
 * Tipos aceitos como anexo. O tipo gravado (e servido depois) sai do CONTEÚDO do arquivo e da
 * extensão — nunca só do que o navegador declarou, que pode ser forjado (ex.: um HTML com
 * "image/png" no cabeçalho).
 */
const TIPOS = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
} as const;
type Extensao = keyof typeof TIPOS;

const comeca = (bytes: Buffer, assinatura: number[]) => assinatura.every((b, i) => bytes[i] === b);

/** Confere a "assinatura" dos primeiros bytes com o que a extensão promete. */
function conteudoConfere(ext: Extensao, bytes: Buffer) {
  switch (ext) {
    case "pdf": return bytes.subarray(0, 1024).includes("%PDF-");
    case "png": return comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
    case "jpeg": return comeca(bytes, [0xff, 0xd8, 0xff]);
    case "docx":
    case "xlsx": return comeca(bytes, [0x50, 0x4b, 0x03, 0x04]); // pacote ZIP do Office
    case "doc":
    case "xls": return comeca(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // Office 97-2003
  }
}

/** Nome do arquivo como será mostrado e baixado: sem caminho, sem caracteres de controle. */
function nomeLimpo(nome: string, ext: Extensao) {
  const base = nome.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim() || "arquivo";
  return base.length > 150 ? `${base.slice(0, 140)}.${ext}` : base;
}

/** Valida e grava um anexo (disco local ou Vercel Blob, ver src/lib/arquivos.ts). */
export async function salvarAnexo(file: File): Promise<string> {
  const maxBytes = limiteAnexoBytes();
  if (file.size > maxBytes) throw new Error(`O arquivo excede o limite de ${maxBytes / 1024 / 1024} MB.`);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(ext in TIPOS)) throw new Error("Tipo de arquivo não permitido. Envie PDF, Word, Excel ou imagem (PNG/JPG).");
  const extensao = ext as Extensao;
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!conteudoConfere(extensao, buffer)) {
    throw new Error(`O conteúdo de "${file.name}" não é um arquivo .${extensao} válido. Salve de novo no programa de origem e envie.`);
  }

  const anexo = await prisma.anexo.create({
    data: { nomeOriginal: nomeLimpo(file.name, extensao), caminho: "pendente", tamanho: buffer.length, tipoMime: TIPOS[extensao] },
  });
  try {
    await gravarArquivo(anexo.id, buffer, anexo.tipoMime);
  } catch (e) {
    await prisma.anexo.delete({ where: { id: anexo.id } }).catch(() => {});
    throw e;
  }
  await prisma.anexo.update({ where: { id: anexo.id }, data: { caminho: `/api/files/${anexo.id}` } });
  return anexo.id;
}
