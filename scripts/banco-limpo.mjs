/**
 * Zera o banco de desenvolvimento e os arquivos enviados, deixando só a configuração base e um
 * administrador (prisma/seed-base.ts). Pare o `npm run dev` antes de rodar.
 *   npm run banco:limpo
 * Para voltar aos dados de demonstração: npm run seed && npm run seed:demo && npm run seed:vitrine
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const raiz = process.cwd();
if ((process.env.DATABASE_URL ?? "").includes("teste")) throw new Error("Use o banco de desenvolvimento, não o de teste.");

function rodar(comando, args) {
  const r = spawnSync(comando, args, { cwd: raiz, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

rodar("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"]);

// Anexos e e-mails gravados localmente pertenciam aos dados apagados (o .gitkeep da pasta fica).
const storage = process.env.STORAGE_DIR ?? path.join(raiz, "storage");
for (const pasta of ["uploads", "emails"]) {
  const alvo = path.join(storage, pasta);
  if (!existsSync(alvo)) continue;
  for (const item of readdirSync(alvo)) {
    if (item !== ".gitkeep") rmSync(path.join(alvo, item), { recursive: true, force: true });
  }
}

rodar("npx", ["tsx", "prisma/seed-base.ts"]);
