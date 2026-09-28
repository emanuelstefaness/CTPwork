import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { enviarEmail, urlDoSistema } from "@/lib/email/transporte";
import { montarEmail } from "@/lib/email/modelo";

/**
 * Convite de primeiro acesso: em vez de o gestor inventar e repassar uma senha, o sistema manda
 * um link para a pessoa criar a dela (mesma tela do "esqueci minha senha"). Só o hash do token
 * fica no banco; o link vale 7 dias e uma única vez. Sem SMTP, o e-mail fica em storage/emails.
 */

export const VALIDADE_CONVITE_MS = 7 * 24 * 60 * 60 * 1000;

export const hashDoToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Senha aleatória que ninguém conhece — a conta só é usável depois de aceitar o convite. */
export async function senhaInutilizavel() {
  return bcrypt.hash(randomBytes(32).toString("hex"), 10);
}

export async function enviarConvite(userId: string, convidadoPor: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { municipio: { select: { nome: true } } } });
  // Um convite novo invalida os anteriores ainda não usados.
  await prisma.tokenSenha.updateMany({ where: { userId, usadoEm: null }, data: { usadoEm: new Date() } });

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.tokenSenha.create({ data: { userId, tokenHash: hashDoToken(token), finalidade: "CONVITE", expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS) } }),
    prisma.user.update({ where: { id: userId }, data: { convitePendente: true } }),
  ]);

  const onde = user.tipo === "EXTERNO" && user.municipio ? ` para acompanhar os projetos da ${user.municipio.nome} com o CTP` : " como parte da equipe do CTP";
  const { html, texto } = montarEmail({
    titulo: "Você foi convidado para o CTP Work",
    introducao: `Olá, ${user.nome.split(" ")[0]}. ${convidadoPor} criou seu acesso ao CTP Work${onde}. Crie sua senha para entrar — o link vale por 7 dias. Seu login é o e-mail ${user.email}.`,
    botao: { rotulo: "Criar minha senha", url: `${urlDoSistema()}/redefinir-senha?token=${token}` },
    rodape: "Se você não esperava este convite, ignore este e-mail.",
  });
  await enviarEmail({ para: user.email, assunto: "Convite para o CTP Work", html, texto });
}
