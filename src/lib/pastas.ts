import path from "path";

/**
 * Pasta dos arquivos gravados pelo sistema (anexos em uploads/, e-mails sem SMTP em emails/).
 * `STORAGE_DIR` permite apontar para outro lugar — os testes automatizados usam uma pasta própria
 * para não misturar com os arquivos do ambiente de desenvolvimento.
 */
export const pastaDados = () => process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");
export const pastaUploads = () => path.join(pastaDados(), "uploads");
export const pastaEmails = () => path.join(pastaDados(), "emails");
