import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // E-mails são gravados em minúsculas no cadastro; o login aceita como a pessoa digitar.
        const user = await prisma.user.findFirst({ where: { email: { in: [email, email.trim().toLowerCase()] } } });
        if (!user || !user.ativo) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.nome,
          email: user.email,
          tipo: user.tipo,
          perfilInterno: user.perfilInterno,
          setorId: user.setorId,
          municipioId: user.municipioId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.tipo = (user as unknown as { tipo: string }).tipo;
        token.perfilInterno = (user as unknown as { perfilInterno: string | null }).perfilInterno;
        token.setorId = (user as unknown as { setorId: string | null }).setorId;
        token.municipioId = (user as unknown as { municipioId: string | null }).municipioId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tipo = token.tipo as string;
        session.user.perfilInterno = token.perfilInterno as string | null;
        session.user.setorId = token.setorId as string | null;
        session.user.municipioId = token.municipioId as string | null;
      }
      return session;
    },
  },
});
