import { prisma } from "@/lib/prisma";
import { gravarArquivo } from "@/lib/arquivos";
import { limiteAnexoBytes } from "@/lib/limite-anexo";

/** Valida e grava um anexo (disco local ou Vercel Blob, ver src/lib/arquivos.ts). */
export async function salvarAnexo(file: File): Promise<string> {
  const maxBytes = limiteAnexoBytes();
  const mimePermitidos = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/png", "image/jpeg"]);
  if (file.size > maxBytes) throw new Error(`O arquivo excede o limite de ${maxBytes / 1024 / 1024} MB.`);
  if (file.type && !mimePermitidos.has(file.type)) throw new Error("Tipo de arquivo não permitido.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const anexo = await prisma.anexo.create({
    data: {
      nomeOriginal: file.name,
      caminho: "pendente",
      tamanho: file.size,
      tipoMime: file.type || "application/octet-stream",
    },
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
