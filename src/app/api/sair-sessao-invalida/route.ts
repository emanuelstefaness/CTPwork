import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

/**
 * Limpa o cookie de uma sessão cujo usuário não existe mais no banco (ver SessaoInvalidaError em
 * src/lib/tenant.ts). Precisa ser uma Route Handler, não um redirect direto de dentro do layout:
 * só aqui é permitido mutar cookies. Redirecionar direto para "/login" sem limpar o cookie causava
 * loop infinito, porque o middleware (src/proxy.ts) decide autenticação só pela presença de um JWT
 * validamente assinado (req.auth), sem checar o banco — com essa checagem mais simples, o JWT
 * antigo ainda parecia "autenticado" e o middleware mandava "/login" de volta para "/".
 */
export async function GET(request: NextRequest) {
  try {
    await signOut({ redirectTo: "/login", redirect: false });
  } catch {
    // signOut pode lançar o sinal interno de redirect do Next — ignorado, pois fazemos o redirect abaixo.
  }
  // Também é o caminho de quem teve o acesso desativado: a tela de entrada explica o que houve.
  return NextResponse.redirect(new URL("/login?sessao=encerrada", request.url));
}
