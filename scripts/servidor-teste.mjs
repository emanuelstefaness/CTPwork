/**
 * Sobe o sistema para os testes automatizados (chamado pelo Playwright, ver playwright.config.ts):
 *   1. banco próprio (prisma/teste.db) recriado do zero + dados de demonstração;
 *   2. pasta de arquivos própria (storage-teste/) — anexos e e-mails dos testes;
 *   3. build de produção e `next start` na porta 4200.
 * O banco de desenvolvimento (dev.db) e a pasta storage/ nunca são tocados.
 * PULAR_BUILD=1 reaproveita o último build (mais rápido quando só os testes mudaram).
 * TESTE_POSTGRES_URL=postgresql://… roda tudo num PostgreSQL descartável (como na Vercel) — o banco é
 * APAGADO. Depois, `npx prisma generate` devolve o cliente do SQLite para o desenvolvimento.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { gerarSchemaPostgres } from "./schema-postgres.mjs";

const raiz = process.cwd();
const porta = process.env.PORTA_TESTE ?? "4200";
const urlPostgres = process.env.TESTE_POSTGRES_URL;
const env = {
  ...process.env,
  DATABASE_URL: urlPostgres ?? "file:./teste.db",
  DIRECT_URL: urlPostgres ?? "",
  STORAGE_DIR: path.join(raiz, "storage-teste"),
  APP_URL: `http://127.0.0.1:${porta}`,
  AUTH_URL: `http://127.0.0.1:${porta}`,
  AUTH_TRUST_HOST: "true",
  MOSTRAR_CONTAS_DEMO: "false",
};
// Os testes nunca enviam e-mail de verdade, mesmo que o .env tenha SMTP configurado.
for (const k of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]) env[k] = "";

if (!urlPostgres && !env.DATABASE_URL.includes("teste")) throw new Error("Proteção: o servidor de teste só roda com o banco de teste.");

function rodar(comando, args) {
  const r = spawnSync(comando, args, { cwd: raiz, env, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`[teste] falhou: ${comando} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

console.log("[teste] preparando banco e arquivos de teste…");
rmSync(env.STORAGE_DIR, { recursive: true, force: true });
mkdirSync(path.join(env.STORAGE_DIR, "uploads"), { recursive: true });
if (urlPostgres) {
  const schema = `--schema=${gerarSchemaPostgres(raiz)}`;
  rodar("npx", ["prisma", "generate", schema]);
  rodar("npx", ["prisma", "db", "push", "--force-reset", "--skip-generate", schema]);
} else {
  rodar("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed", "--skip-generate"]);
}
rodar("npx", ["tsx", "prisma/seed.ts"]);
rodar("npx", ["tsx", "prisma/seed-demo.ts"]);

if (process.env.PULAR_BUILD !== "1") {
  console.log("[teste] gerando build de produção…");
  rodar("npx", ["next", "build"]);
}

console.log(`[teste] servidor em http://127.0.0.1:${porta}`);
const servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", porta, "--keepAliveTimeout", "65000"], {
  cwd: raiz,
  env,
  stdio: "inherit",
});
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => servidor.kill(sinal));
servidor.on("exit", (codigo) => process.exit(codigo ?? 0));
