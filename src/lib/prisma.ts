import { PrismaClient } from "@prisma/client";

/**
 * Cliente único do banco. A extensão abaixo faz cada Notificacao gravada também sair por e-mail
 * (ver src/lib/email/despacho.ts) — assim nenhum ponto do sistema que notifica precisa lembrar
 * do e-mail. O import é dinâmico porque o despacho usa este mesmo cliente.
 */

/**
 * Endereço "pooled" do Neon (host com -pooler) passa por PgBouncer em modo transação, que não guarda
 * prepared statements entre conexões; `pgbouncer=true` faz o Prisma não depender deles.
 */
function urlDoBanco() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.includes("-pooler.") || url.includes("pgbouncer=")) return undefined;
  return `${url}${url.includes("?") ? "&" : "?"}pgbouncer=true`;
}

function criarCliente() {
  const agendarEmail = () => {
    void import("@/lib/email/despacho").then((m) => m.agendarDespachoEmails()).catch(() => {});
  };
  return new PrismaClient({ datasourceUrl: urlDoBanco() }).$extends({
    query: {
      notificacao: {
        async create({ args, query }) {
          const r = await query(args);
          agendarEmail();
          return r;
        },
        async createMany({ args, query }) {
          const r = await query(args);
          agendarEmail();
          return r;
        },
      },
    },
  });
}

type Cliente = ReturnType<typeof criarCliente>;
const globalForPrisma = globalThis as unknown as { prisma?: Cliente };

export const prisma = globalForPrisma.prisma ?? criarCliente();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
