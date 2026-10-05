/**
 * Build da publicação na Vercel (a Vercel roda `npm run vercel-build` no lugar de `npm run build`).
 * Passo a passo da configuração: docs/PUBLICAR-NA-VERCEL.md.
 *   1. confere as variáveis obrigatórias;
 *   2. gera prisma/postgres/schema.prisma (scripts/schema-postgres.mjs) e o cliente Prisma dele;
 *   3. `prisma db push`: cria/atualiza as tabelas. Recusa mudanças que apagariam dados;
 *   4. no banco vazio: com DADOS_DEMONSTRACAO=true, semeia a demonstração completa (seed, seed-demo,
 *      seed-vitrine — contas com a senha pública ctpwork123); senão, só a configuração base e o
 *      administrador (prisma/seed-base.ts). Com usuários já cadastrados, nada é semeado;
 *   5. `next build`.
 * PULAR_BUILD=1 faz só os passos 1–4 (para preparar um banco PostgreSQL fora da Vercel).
 */
import { spawnSync } from "node:child_process";
import { gerarSchemaPostgres } from "./schema-postgres.mjs";

const raiz = process.cwd();
const erro = (msg) => {
  console.error(`\n[publicação] ${msg}\n`);
  process.exit(1);
};

const url = process.env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\//.test(url)) {
  erro("DATABASE_URL precisa ser um PostgreSQL (postgresql://…). Na Vercel: Storage › Neon › conectar ao projeto.");
}
if (process.env.VERCEL && !process.env.AUTH_SECRET) {
  erro("Falta AUTH_SECRET nas variáveis de ambiente (gere com: npx auth secret).");
}
if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
  console.warn("[publicação] Atenção: nenhum Vercel Blob ligado — o envio de anexos vai falhar. Storage › Blob › conectar ao projeto.");
}

// O `db push` precisa de conexão direta; o endereço "pooled" do Neon (PgBouncer) não aceita.
const env = {
  ...process.env,
  DIRECT_URL: process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DIRECT_URL ?? url,
};

function rodar(comando, args) {
  console.log(`\n[publicação] ${comando} ${args.join(" ")}`);
  const r = spawnSync(comando, args, { cwd: raiz, env, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) erro(`falhou: ${comando} ${args.join(" ")}`);
}

const schema = `--schema=${gerarSchemaPostgres(raiz)}`;
rodar("npx", ["prisma", "generate", schema]);
rodar("npx", ["prisma", "db", "push", "--skip-generate", schema]);
if (process.env.DADOS_DEMONSTRACAO === "true") {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasourceUrl: env.DIRECT_URL });
  const vazio = (await prisma.user.count()) === 0;
  await prisma.$disconnect();
  if (vazio) for (const seed of ["seed", "seed-demo", "seed-vitrine"]) rodar("npx", ["tsx", `prisma/${seed}.ts`]);
  else console.log("[publicação] Banco já tem usuários: dados de demonstração não semeados de novo.");
} else {
  rodar("npx", ["tsx", "prisma/seed-base.ts"]);
}
if (process.env.PULAR_BUILD !== "1") rodar("npx", ["next", "build"]);
