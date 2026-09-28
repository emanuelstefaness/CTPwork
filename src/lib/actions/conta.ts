"use server";

import { randomBytes } from "crypto";
import { hashDoToken } from "@/lib/convites";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";
import { capturar, ErroUsuario, type Resultado } from "@/lib/resultado";
import { registrarAuditoria } from "@/lib/audit";
import { enviarEmail, urlDoSistema } from "@/lib/email/transporte";
import { montarEmail } from "@/lib/email/modelo";
import { bloqueado, registrarFalha } from "@/lib/limite-tentativas";

const SENHA_MINIMA = 8;
const VALIDADE_TOKEN_MS = 60 * 60 * 1000; // 1 hora



function validarNovaSenha(nova: string, confirmacao: string) {
  if (nova.length < SENHA_MINIMA) throw new ErroUsuario(`A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
  if (!/[a-zA-Z]/.test(nova) || !/\d/.test(nova)) throw new ErroUsuario("Use letras e números na nova senha.");
  if (nova !== confirmacao) throw new ErroUsuario("A confirmação não confere com a nova senha.");
}

/* ───────── Minha conta (usuário logado) ───────── */

export async function alterarSenha(formData: FormData): Promise<Resultado<{ mensagem: string }>> {
  return capturar(async () => {
    const sessao = await requireSession();
    const atual = String(formData.get("senhaAtual") ?? "");
    const nova = String(formData.get("novaSenha") ?? "");
    validarNovaSenha(nova, String(formData.get("confirmacao") ?? ""));

    const chave = `senha:${sessao.id}`;
    if (bloqueado(chave, 5, 15 * 60 * 1000)) throw new ErroUsuario("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: sessao.id } });
    if (!(await bcrypt.compare(atual, user.passwordHash))) {
      registrarFalha(chave, 15 * 60 * 1000);
      throw new ErroUsuario("A senha atual está incorreta.");
    }
    if (await bcrypt.compare(nova, user.passwordHash)) throw new ErroUsuario("A nova senha precisa ser diferente da atual.");

    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(nova, 10) } });
    await registrarAuditoria({ userId: user.id, acao: "ALTERAR_SENHA", entidadeTipo: "User", entidadeId: user.id });
    return { mensagem: "Senha alterada." };
  });
}

export async function alterarPreferencias(formData: FormData): Promise<Resultado<{ mensagem: string }>> {
  return capturar(async () => {
    const sessao = await requireSession();
    const receberEmail = formData.get("receberEmail") === "on";
    await prisma.user.update({ where: { id: sessao.id }, data: { receberEmail } });
    revalidatePath("/conta");
    return { mensagem: receberEmail ? "Você voltará a receber avisos por e-mail." : "Avisos por e-mail desativados." };
  });
}

/* ───────── Esqueci minha senha (público) ───────── */

/**
 * Sempre responde a mesma coisa, exista ou não a conta — não revela quais e-mails estão
 * cadastrados. Se existir, manda um link de uso único válido por 1 hora.
 */
export async function solicitarRedefinicao(formData: FormData): Promise<Resultado<{ mensagem: string }>> {
  return capturar(async () => {
    const email = String(formData.get("email") ?? "").trim();
    if (!email || !email.includes("@")) throw new ErroUsuario("Informe o e-mail da sua conta.");
    const resposta = { mensagem: "Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Confira sua caixa de entrada (e o spam)." };

    const chave = `redefinir:${email.toLowerCase()}`;
    if (bloqueado(chave, 3, 60 * 60 * 1000)) return resposta;
    registrarFalha(chave, 60 * 60 * 1000);

    const user = await prisma.user.findFirst({ where: { email: { in: [email, email.toLowerCase()] }, ativo: true } });
    if (!user) return resposta;

    const token = randomBytes(32).toString("base64url");
    await prisma.tokenSenha.create({ data: { userId: user.id, tokenHash: hashDoToken(token), expiraEm: new Date(Date.now() + VALIDADE_TOKEN_MS) } });
    const link = `${urlDoSistema()}/redefinir-senha?token=${token}`;
    const { html, texto } = montarEmail({
      titulo: "Crie uma nova senha",
      introducao: `Olá, ${user.nome.split(" ")[0]}. Recebemos um pedido para redefinir a senha da sua conta no CTP Work. O link vale por 1 hora e só pode ser usado uma vez.`,
      botao: { rotulo: "Criar nova senha", url: link },
      rodape: "Se você não pediu isso, ignore este e-mail — sua senha atual continua valendo.",
    });
    await enviarEmail({ para: user.email, assunto: "CTP Work: redefinição de senha", html, texto });
    await registrarAuditoria({ userId: user.id, acao: "SOLICITAR_REDEFINICAO_SENHA", entidadeTipo: "User", entidadeId: user.id });
    return resposta;
  });
}

export async function redefinirSenha(formData: FormData): Promise<Resultado<{ mensagem: string }>> {
  return capturar(async () => {
    const token = String(formData.get("token") ?? "");
    const nova = String(formData.get("novaSenha") ?? "");
    validarNovaSenha(nova, String(formData.get("confirmacao") ?? ""));

    const registro = token ? await prisma.tokenSenha.findUnique({ where: { tokenHash: hashDoToken(token) } }) : null;
    if (!registro || registro.usadoEm || registro.expiraEm < new Date()) {
      throw new ErroUsuario(registro?.finalidade === "CONVITE"
        ? "Este convite expirou ou já foi usado. Peça um novo convite à equipe do CTP."
        : 'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".');
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: registro.userId }, data: { passwordHash: await bcrypt.hash(nova, 10), convitePendente: false } }),
      // Invalida este e qualquer outro link pendente da mesma pessoa.
      prisma.tokenSenha.updateMany({ where: { userId: registro.userId, usadoEm: null }, data: { usadoEm: new Date() } }),
    ]);
    const convite = registro.finalidade === "CONVITE";
    await registrarAuditoria({ userId: registro.userId, acao: convite ? "ACEITAR_CONVITE" : "REDEFINIR_SENHA", entidadeTipo: "User", entidadeId: registro.userId });
    return { mensagem: convite ? "Pronto! Sua senha foi criada. Entre com seu e-mail e a nova senha." : "Senha criada. Entre com a nova senha." };
  });
}
