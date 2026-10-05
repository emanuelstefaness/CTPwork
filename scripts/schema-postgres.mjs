/**
 * Gera prisma/postgres/schema.prisma: o mesmo schema do desenvolvimento (prisma/schema.prisma),
 * trocando SQLite por PostgreSQL. Usado na publicação (vercel-build.mjs) e nos testes contra
 * PostgreSQL (servidor-teste.mjs com TESTE_POSTGRES_URL). As migrações de prisma/migrations são SQL
 * de SQLite: no PostgreSQL as tabelas vêm de `prisma db push` com este schema.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SCHEMA_POSTGRES = "prisma/postgres/schema.prisma";

export function gerarSchemaPostgres(raiz = process.cwd()) {
  const original = readFileSync(path.join(raiz, "prisma", "schema.prisma"), "utf8");
  const datasource = /datasource db \{[^}]*provider\s*=\s*"sqlite"[^}]*\}/;
  if (!datasource.test(original)) throw new Error("Não encontrei o bloco datasource com provider sqlite em prisma/schema.prisma.");
  const gerado =
    "// GERADO por scripts/schema-postgres.mjs a partir de prisma/schema.prisma — não editar.\n" +
    original.replace(datasource, 'datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}');
  const destino = path.join(raiz, SCHEMA_POSTGRES);
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, gerado);
  return SCHEMA_POSTGRES;
}
