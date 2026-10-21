import { DefaultSession } from "next-auth";

// O cookie de sessão identifica a pessoa e a versão da sessão; o resto vem do banco a cada
// requisição (src/lib/tenant.ts).

declare module "next-auth" {
  interface Session {
    user: { id: string; sessaoVersao: number } & DefaultSession["user"];
  }

  interface User {
    sessaoVersao: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    sessaoVersao: number;
  }
}
