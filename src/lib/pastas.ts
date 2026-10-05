import os from "os";
import path from "path";

/**
 * Pasta dos arquivos gravados pelo sistema (anexos em uploads/, e-mails sem SMTP em emails/).
 * `STORAGE_DIR` permite apontar para outro lugar — os testes automatizados usam uma pasta própria
 * para não misturar com os arquivos do ambiente de desenvolvimento.
 * Na Vercel só a pasta temporária aceita escrita (e é apagada entre requisições): os anexos vão
 * para o Vercel Blob (src/lib/arquivos.ts) e os e-mails sem SMTP caem lá, sem derrubar a ação.
 */
const pastaPadrao = () => (process.env.VERCEL ? path.join(os.tmpdir(), "ctp-work") : path.join(process.cwd(), "storage"));
export const pastaDados = () => process.env.STORAGE_DIR ?? pastaPadrao();
export const pastaUploads = () => path.join(pastaDados(), "uploads");
export const pastaEmails = () => path.join(pastaDados(), "emails");
