import { auth } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/redefinir-senha"];

/**
 * Content-Security-Policy com nonce: só roda script que o próprio Next marcou nesta requisição
 * (um script injetado por um atacante não tem o nonce e é bloqueado). Estilos inline continuam
 * permitidos — o editor, os gráficos e as cores de grifo usam `style`. Rotas /api (arquivos,
 * Word, auth) ficam de fora: não são páginas e o visualizador de PDF do navegador não precisa dela.
 */
function politicaDeConteudo(nonce: string, https: boolean) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function comCsp(req: NextRequest, response?: NextResponse) {
  const { pathname } = req.nextUrl;
  const prefetch = req.headers.has("next-router-prefetch") || req.headers.get("purpose") === "prefetch";
  if (pathname.startsWith("/api") || prefetch) return response ?? NextResponse.next();

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const https = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const csp = politicaDeConteudo(nonce, https);

  // O Next lê o nonce do cabeçalho da requisição e o aplica aos próprios scripts ao renderizar.
  const cabecalhos = new Headers(req.headers);
  cabecalhos.set("x-nonce", nonce);
  cabecalhos.set("Content-Security-Policy", csp);
  const resposta = response ?? NextResponse.next({ request: { headers: cabecalhos } });
  resposta.headers.set("Content-Security-Policy", csp);
  return resposta;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isApiAuth = pathname.startsWith("/api/auth");

  if (!req.auth && !isPublic && !isApiAuth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Só a abertura da página: um POST (o próprio formulário de login, vindo de uma aba antiga ou
  // com a sessão ainda viva) seguiria o 307 como POST para "/" e cairia numa tela de erro.
  if (req.auth && pathname === "/login" && req.method === "GET") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return comCsp(req);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
