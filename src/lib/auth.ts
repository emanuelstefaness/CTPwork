import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { conferirSenha, gastarTempoDeComparacao } from "@/lib/senha";
import { bloqueado, limpar, registrarFalha } from "@/lib/limite-tentativas";
import { ipDaRequisicao } from "@/lib/ip";
import { registrarAuditoria } from "@/lib/audit";

/** Login recusado por excesso de tentativas (o formulário mostra quanto tempo esperar). */
class LoginBloqueado extends CredentialsSignin {
  code = "bloqueado";
}

const JANELA_MS = 15 * 60 * 1000;
const MAX_POR_EMAIL = 5;
const MAX_POR_IP = 30;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Sessão expira após 8 horas sem uso; enquanto a pessoa usa, é renovada a cada 15 minutos.
  session: { strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 15 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      // O limite de tentativas fica aqui, e não só no formulário: /api/auth/callback/credentials
      // também chega neste ponto quando chamado direto.
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").trim().toLowerCase().slice(0, 254);
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const ip = ipDaRequisicao(request.headers);
        const chaveEmail = `login:${email}`;
        const chaveIp = `login-ip:${ip}`;
        if ((await bloqueado(chaveEmail, MAX_POR_EMAIL, JANELA_MS)) || (await bloqueado(chaveIp, MAX_POR_IP, JANELA_MS))) {
          throw new LoginBloqueado();
        }

        const user = await prisma.user.findUnique({ where: { email } });
        const valida = user ? await conferirSenha(password, user.passwordHash) : await gastarTempoDeComparacao(password);
        if (!user || !valida || !user.ativo) {
          await registrarFalha(chaveEmail);
          await registrarFalha(chaveIp);
          return null;
        }

        await limpar(chaveEmail);
        await registrarAuditoria({ userId: user.id, acao: "ENTRAR", entidadeTipo: "User", entidadeId: user.id, detalhe: `ip=${ip}` });
        return { id: user.id, name: user.nome, email: user.email, sessaoVersao: user.sessaoVersao };
      },
    }),
  ],
  callbacks: {
    // O token guarda só quem é a pessoa e a versão da sessão; perfil, permissões e município são
    // lidos do banco a cada requisição (src/lib/tenant.ts).
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.sessaoVersao = user.sessaoVersao;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.sessaoVersao = token.sessaoVersao as number;
      }
      return session;
    },
  },
});
