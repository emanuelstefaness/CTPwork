import type { Metadata } from "next";
import Link from "next/link";
import { redefinirSenha } from "@/lib/actions/conta";
import { prisma } from "@/lib/prisma";
import { hashDoToken } from "@/lib/convites";
import { FormMensagem } from "@/components/form-mensagem";
import { TelaPublica } from "@/components/tela-publica";

export const metadata: Metadata = { title: "Criar nova senha" };

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <TelaPublica titulo="Link incompleto" descricao="Abra o link exatamente como chegou no e-mail, ou peça um novo.">
        <Link href="/esqueci-senha" className="primary-button h-11 w-full">Pedir novo link</Link>
      </TelaPublica>
    );
  }

  // Convite de primeiro acesso (Cadastros) ou "esqueci minha senha": mesma tela, textos diferentes.
  const registro = await prisma.tokenSenha.findUnique({ where: { tokenHash: hashDoToken(token) }, include: { user: { select: { nome: true, email: true } } } });
  const convite = registro?.finalidade === "CONVITE" && !registro.usadoEm && registro.expiraEm > new Date();

  return (
    <TelaPublica
      titulo={convite ? `Bem-vindo(a), ${registro!.user.nome.split(" ")[0]}` : "Criar nova senha"}
      descricao={
        convite
          ? `Crie sua senha para acessar o CTP Work. Seu login é ${registro!.user.email}. Use pelo menos 8 caracteres, com letras e números.`
          : "Escolha uma senha com pelo menos 8 caracteres, com letras e números."
      }
    >
      <FormMensagem acao={redefinirSenha} className="flex flex-col gap-5" depois={<Link href="/login" className="primary-button mt-4 h-11 w-full">Entrar</Link>}>
        <input type="hidden" name="token" value={token} />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-700">Nova senha</span>
          <input type="password" name="novaSenha" required minLength={8} autoComplete="new-password" className="form-control h-11" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-700">Repita a nova senha</span>
          <input type="password" name="confirmacao" required minLength={8} autoComplete="new-password" className="form-control h-11" />
        </label>
        <button className="primary-button h-11 w-full">{convite ? "Criar minha senha" : "Salvar nova senha"}</button>
      </FormMensagem>
    </TelaPublica>
  );
}
