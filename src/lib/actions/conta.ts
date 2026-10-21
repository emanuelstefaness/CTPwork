"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { signOut } from "@/lib/auth";
import { requireSession } from "@/lib/tenant";
import { capturar, ErroUsuario, type Resultado } from "@/lib/resultado";
import { registrarAuditoria } from "@/lib/audit";
import { enviarEmail, urlDoSistema } from "@/lib/email/transporte";
import { montarEmail } from "@/lib/email/modelo";
import { bloqueado, limpar, registrarFalha } from "@/lib/limite-tentativas";
import { conferirSenha, gerarHashSenha, problemaDaSenha } from "@/lib/senha";
import { ipDaRequisicao } from "@/lib/ip";

const VALIDADE_TOKEN_MS = 60 * 60 * 1000; // 1 hora
const JANELA_MS = 15 * 60 * 1000;

const hashDoToken = (token: string) => createHash("sha256").update(token).digest("hex");

function validarNovaSenha(nova: string, confirmacao: string) {
  const problema = problemaDaSenha(nova);
  if (problema) throw new ErroUsuario(problema);
  if (nova !== confirmacao) throw new ErroUsuario("A confirmação não confere com a nova senha.");
}

/* ───────── Minha conta (usuário logado) ───────── */

/**
 * Troca a própria senha e encerra TODAS as sessões abertas (outro computador, celular perdido),
 * inclusive esta: a pessoa entra de novo com a senha nova, o que também confirma que a sabe.
 */
export async function alterarSenha(formData: FormData): Promise<Resultado<{ mensagem: string }>> {
  return capturar(async () => {
    const sessao = await requireSession({ permitirTrocaPendente: true });
    const atual = String(formData.get("senhaAtual") ?? "");
    const nova = String(formData.get("novaSenha") ?? "");
    validarNovaSenha(nova, String(formData.get("confirmacao") ?? ""));

    const chave = `senha:${sessao.id}`;
    if (await bloqueado(chave, 5, JANELA_MS)) throw new ErroUsuario("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: sessao.id } });
    if (!(await conferirSenha(atual, user.passwordHash))) {
      await registrarFalha(chave);
      throw new ErroUsuario("A senha atual está incorreta.");
    }
    if (await conferirSenha(nova, user.passwordHash)) throw new ErroUsuario("A nova senha precisa ser diferente da atual.");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await gerarHashSenha(nova), trocarSenha: false, sessaoVersao: { increment: 1 } },
    });
    await limpar(chave);
    await registrarAuditoria({ userId: user.id, acao: "ALTERAR_SENHA", entidadeTipo: "User", entidadeId: user.id });
    await signOut({ redirect: false });
    redirect("/login?senha=alterada");
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

    // Até 3 pedidos por e-mail e 20 por IP a cada hora; acima disso, a mesma resposta e nada enviado.
    const chaves = [`redefinir:${email.toLowerCase()}`, `redefinir-ip:${ipDaRequisicao(await headers())}`];
    if ((await bloqueado(chaves[0], 3, 60 * 60 * 1000)) || (await bloqueado(chaves[1], 20, 60 * 60 * 1000))) return resposta;
    for (const chave of chaves) await registrarFalha(chave);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.ativo) return resposta;
    const token = randomBytes(32).toString("base64url");
    await prisma.tokenSenha.create({ data: { userId: user.id, tokenHash: hashDoToken(token), expiraEm: new Date(Date.now() + VALIDADE_TOKEN_MS) } });
    const link = `${urlDoSistema()}/redefinir-senha?token=${token}`;
    const { html, texto } = montarEmail({
      titulo: "Crie uma nova senha",
      introducao: `Olá, ${user.nome.split(" ")[0]}. Recebemos um pedido para redefinir a senha da sua conta no CTP Work. O link vale por 1 hora e só pode ser usado uma vez.`,
      botao: { rotulo: "Criar nova senha", url: link },
      rodape: "Se você não pediu isso, ignore este e-mail — sua senha atual continua valendo.",
    });
    // Envio depois da resposta: o tempo de resposta não revela se a conta existe.
    after(async () => {
      await enviarEmail({ para: user.email, assunto: "CTP Work: redefinição de senha", html, texto });
      await registrarAuditoria({ userId: user.id, acao: "SOLICITAR_REDEFINICAO_SENHA", entidadeTipo: "User", entidadeId: user.id });
    });
    return resposta;
  });
}

export async function redefinirSenha(formData: FormData): Promise<Resultado<{ mensagem: string }>> {
  return capturar(async () => {
    const token = String(formData.get("token") ?? "");
    const nova = String(formData.get("novaSenha") ?? "");
    validarNovaSenha(nova, String(formData.get("confirmacao") ?? ""));

    const tokenHash = hashDoToken(token);
    const registro = token ? await prisma.tokenSenha.findUnique({ where: { tokenHash }, include: { user: { select: { ativo: true } } } }) : null;
    const invalido = 'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".';
    if (!registro || registro.usadoEm || registro.expiraEm < new Date() || !registro.user.ativo) throw new ErroUsuario(invalido);

    const passwordHash = await gerarHashSenha(nova);
    await prisma.$transaction(async (tx) => {
      // Consome o link só se ninguém o usou no meio-tempo (dois envios ao mesmo tempo não passam).
      const consumido = await tx.tokenSenha.updateMany({ where: { tokenHash, usadoEm: null, expiraEm: { gt: new Date() } }, data: { usadoEm: new Date() } });
      if (consumido.count !== 1) throw new ErroUsuario(invalido);
      // Outros links pendentes param de valer; sessões abertas com a senha antiga são encerradas.
      await tx.tokenSenha.updateMany({ where: { userId: registro.userId, usadoEm: null }, data: { usadoEm: new Date() } });
      await tx.user.update({ where: { id: registro.userId }, data: { passwordHash, trocarSenha: false, sessaoVersao: { increment: 1 } } });
    });
    await registrarAuditoria({ userId: registro.userId, acao: "REDEFINIR_SENHA", entidadeTipo: "User", entidadeId: registro.userId });
    return { mensagem: "Senha criada. Entre com a nova senha." };
  });
}
