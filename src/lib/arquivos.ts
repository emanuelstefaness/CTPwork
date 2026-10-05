import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { pastaUploads } from "@/lib/pastas";

/**
 * Onde ficam os bytes dos anexos. Com um Vercel Blob ligado ao projeto (a Vercel define
 * BLOB_READ_WRITE_TOKEN), vão para o Blob como arquivos privados — o disco da Vercel é apagado a
 * cada requisição. Sem ele (desenvolvimento, servidor próprio), ficam em storage/uploads.
 * Quem pode baixar continua sendo decidido em /api/files/[id]; o Blob nunca é exposto ao navegador.
 */

const usaBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const caminhoNoBlob = (id: string) => `uploads/${id}`;

export async function gravarArquivo(id: string, bytes: Buffer, tipoMime: string): Promise<void> {
  if (usaBlob()) {
    const { put } = await import("@vercel/blob");
    await put(caminhoNoBlob(id), bytes, { access: "private", contentType: tipoMime, addRandomSuffix: false, allowOverwrite: false });
    return;
  }
  const pasta = pastaUploads();
  await mkdir(pasta, { recursive: true });
  await writeFile(path.join(pasta, id), bytes, { flag: "wx" });
}

/** Bytes do anexo, ou null se o arquivo não existe mais. */
export async function lerArquivo(id: string): Promise<ReadableStream<Uint8Array> | Buffer | null> {
  if (usaBlob()) {
    const { get } = await import("@vercel/blob");
    const r = await get(caminhoNoBlob(id), { access: "private" });
    return r?.stream ?? null;
  }
  try {
    return await readFile(path.join(pastaUploads(), id));
  } catch {
    return null;
  }
}
