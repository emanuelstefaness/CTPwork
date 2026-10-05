/**
 * Tamanho máximo de um anexo. Na Vercel, cada requisição aceita no máximo 4,5 MB (limite da
 * plataforma, não do sistema), então lá o teto é 4 MB; em servidor próprio, 20 MB.
 * A Vercel expõe NEXT_PUBLIC_VERCEL_ENV ao navegador, então o mesmo valor vale nos dois lados.
 */
const MB = 1024 * 1024;

export const limiteAnexoBytes = () => (process.env.NEXT_PUBLIC_VERCEL_ENV ? 4 : 20) * MB;

export const limiteAnexoTexto = () => `${limiteAnexoBytes() / MB} MB`;
