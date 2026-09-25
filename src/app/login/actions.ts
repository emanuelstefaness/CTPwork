"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { bloqueado, limpar, registrarFalha } from "@/lib/limite-tentativas";

const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000;

export async function loginAction(
  _prevState: { erro?: string; email?: string } | undefined,
  formData: FormData
): Promise<{ erro?: string; email?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");
  const chave = `login:${email.toLowerCase()}`;

  const espera = bloqueado(chave, MAX_FALHAS, JANELA_MS);
  if (espera > 0) {
    return { email, erro: `Muitas tentativas sem sucesso. Tente de novo em ${Math.ceil(espera / 60000)} minuto(s) ou use "Esqueci minha senha".` };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      registrarFalha(chave, JANELA_MS);
      return { email, erro: "E-mail ou senha incorretos." };
    }
    limpar(chave); // redirect de sucesso passa por aqui como exceção do Next
    throw err;
  }
}
