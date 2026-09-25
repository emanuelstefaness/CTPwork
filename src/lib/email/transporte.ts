import nodemailer, { type Transporter } from "nodemailer";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { pastaEmails } from "@/lib/pastas";

/**
 * Envio de e-mail. Com SMTP_HOST definido, envia de verdade (qualquer provedor SMTP: o do
 * domínio do CTP, Amazon SES, SendGrid, Brevo…). Sem SMTP_HOST — o padrão em desenvolvimento —
 * a mensagem é gravada em storage/emails/*.html para conferência e NADA sai da máquina.
 */

export type Email = { para: string; assunto: string; texto: string; html: string };

export const emailConfigurado = () => !!process.env.SMTP_HOST;

export const urlDoSistema = () => (process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:4100").replace(/\/+$/, "");

let transporte: Transporter | null = null;
function obterTransporte() {
  if (!transporte) {
    const porta = Number(process.env.SMTP_PORT ?? 587);
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: porta,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : porta === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporte;
}

export async function enviarEmail(email: Email): Promise<{ modo: "smtp" | "arquivo" }> {
  if (!emailConfigurado()) {
    const pasta = pastaEmails();
    await mkdir(pasta, { recursive: true });
    const nome = `${new Date().toISOString().replace(/[:.]/g, "-")}-${email.para.replace(/[^a-z0-9@._-]/gi, "_")}.html`;
    const seguro = (s: string) => s.replace(/--/g, "—"); // "--" encerraria o comentário HTML
    const cabecalho = `<!-- Para: ${seguro(email.para)} | Assunto: ${seguro(email.assunto)} -->`;
    await writeFile(path.join(pasta, nome), `${cabecalho}\n${email.html}`);
    return { modo: "arquivo" };
  }
  await obterTransporte().sendMail({
    from: process.env.EMAIL_FROM ?? "CTP Work <nao-responda@ctp.org.br>",
    to: email.para,
    subject: email.assunto,
    text: email.texto,
    html: email.html,
  });
  return { modo: "smtp" };
}
