import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tipo: string;
      perfilInterno: string | null;
      setorId: string | null;
      municipioId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    tipo: string;
    perfilInterno: string | null;
    setorId: string | null;
    municipioId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tipo: string;
    perfilInterno: string | null;
    setorId: string | null;
    municipioId: string | null;
  }
}
