import type { NextConfig } from "next";
import path from "node:path";

/**
 * Cabeçalhos de segurança em todas as respostas (páginas, API e arquivos). A política de conteúdo
 * (CSP), que precisa de um nonce novo a cada requisição, é montada em src/proxy.ts.
 */
const cabecalhosSeguranca = [
  { key: "X-Content-Type-Options", value: "nosniff" }, // navegador não "adivinha" o tipo de um anexo
  { key: "X-Frame-Options", value: "DENY" }, // ninguém embute o sistema num iframe (clickjacking)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // links externos não levam a URL interna
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS só em produção: força HTTPS por 2 anos depois do primeiro acesso seguro.
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // não anuncia "X-Powered-By: Next.js"
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosSeguranca }];
  },
  allowedDevOrigins: ["terminal.local"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      // Anexos vão por server action (chat, checklist, conversas, importar .docx). O padrão do Next
      // é 1 MB, o que barrava qualquer PDF maior; o limite real por arquivo (20 MB) é checado em
      // src/lib/storage.ts e, antes do envio, no navegador (src/components/use-envio.ts).
      bodySizeLimit: "22mb",
    },
  },
};

export default nextConfig;
