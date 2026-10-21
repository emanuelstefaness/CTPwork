"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

/** Destino depois do login: só caminhos internos do sistema ("//outro-site" não conta). */
function destinoSeguro(valor: string) {
  return valor.startsWith("/") && !valor.startsWith("//") && !valor.startsWith("/\\") ? valor : "/";
}

export async function loginAction(
  _prevState: { erro?: string; email?: string } | undefined,
  formData: FormData
): Promise<{ erro?: string; email?: string }> {
  const email = String(formData.get("email") ?? "").trim().slice(0, 254);
  const password = String(formData.get("password") ?? "");
  const callbackUrl = destinoSeguro(String(formData.get("callbackUrl") ?? "/"));

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      // O limite de tentativas é aplicado em src/lib/auth.ts (vale também para quem chama a API direto).
      const bloqueado = "code" in err && err.code === "bloqueado";
      return {
        email,
        erro: bloqueado
          ? 'Muitas tentativas sem sucesso. Aguarde 15 minutos e tente de novo, ou use "Esqueci minha senha".'
          : "E-mail ou senha incorretos.",
      };
    }
    throw err; // o redirect de sucesso chega aqui como exceção do Next
  }
}
