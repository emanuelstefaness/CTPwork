import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { pastaUploads } from "@/lib/pastas";

/** Upload simples em disco local. Trocar por S3/blob storage é isolado a este módulo. */
export async function salvarAnexo(file: File): Promise<string> {
  const UPLOAD_DIR = pastaUploads();
  await mkdir(UPLOAD_DIR, { recursive: true });
  const maxBytes = 20 * 1024 * 1024;
  const mimePermitidos = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/png", "image/jpeg"]);
  if (file.size > maxBytes) throw new Error("O arquivo excede o limite de 20 MB.");
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
  await writeFile(path.join(UPLOAD_DIR, anexo.id), buffer, { flag: "wx" });
  await prisma.anexo.update({ where: { id: anexo.id }, data: { caminho: `/api/files/${anexo.id}` } });
  return anexo.id;
}
