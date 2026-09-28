-- CreateTable
CREATE TABLE "Perfil" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL,
    "permissoes" TEXT NOT NULL DEFAULT '[]',
    "somenteParticipa" BOOLEAN NOT NULL DEFAULT false,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EtapaContrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contratoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "curto" TEXT NOT NULL,
    "exigeAssinaturas" BOOLEAN NOT NULL DEFAULT false,
    "liberaProjeto" BOOLEAN NOT NULL DEFAULT false,
    "perfisQueAvancam" TEXT NOT NULL DEFAULT '[]',
    "concluidaEm" DATETIME,
    "concluidaPorId" TEXT,
    CONSTRAINT "EtapaContrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EtapaContrato_concluidaPorId_fkey" FOREIGN KEY ("concluidaPorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EtapaContrato" ("chave", "concluidaEm", "concluidaPorId", "contratoId", "curto", "exigeAssinaturas", "id", "liberaProjeto", "nome", "ordem") SELECT "chave", "concluidaEm", "concluidaPorId", "contratoId", "curto", "exigeAssinaturas", "id", "liberaProjeto", "nome", "ordem" FROM "EtapaContrato";
DROP TABLE "EtapaContrato";
ALTER TABLE "new_EtapaContrato" RENAME TO "EtapaContrato";
CREATE INDEX "EtapaContrato_contratoId_ordem_idx" ON "EtapaContrato"("contratoId", "ordem");
CREATE UNIQUE INDEX "EtapaContrato_contratoId_chave_key" ON "EtapaContrato"("contratoId", "chave");
CREATE TABLE "new_EtapaFluxoContrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fluxoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "curto" TEXT NOT NULL,
    "exigeAssinaturas" BOOLEAN NOT NULL DEFAULT false,
    "liberaProjeto" BOOLEAN NOT NULL DEFAULT false,
    "perfisQueAvancam" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EtapaFluxoContrato_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES "FluxoContrato" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EtapaFluxoContrato" ("chave", "createdAt", "curto", "exigeAssinaturas", "fluxoId", "id", "liberaProjeto", "nome", "ordem") SELECT "chave", "createdAt", "curto", "exigeAssinaturas", "fluxoId", "id", "liberaProjeto", "nome", "ordem" FROM "EtapaFluxoContrato";
DROP TABLE "EtapaFluxoContrato";
ALTER TABLE "new_EtapaFluxoContrato" RENAME TO "EtapaFluxoContrato";
CREATE INDEX "EtapaFluxoContrato_fluxoId_ordem_idx" ON "EtapaFluxoContrato"("fluxoId", "ordem");
CREATE UNIQUE INDEX "EtapaFluxoContrato_fluxoId_chave_key" ON "EtapaFluxoContrato"("fluxoId", "chave");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "perfilInterno" TEXT,
    "perfilId" TEXT,
    "setorId" TEXT,
    "municipioId" TEXT,
    "receberEmail" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "desativadoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("ativo", "createdAt", "desativadoEm", "email", "id", "municipioId", "nome", "passwordHash", "perfilInterno", "receberEmail", "setorId", "tipo") SELECT "ativo", "createdAt", "desativadoEm", "email", "id", "municipioId", "nome", "passwordHash", "perfilInterno", "receberEmail", "setorId", "tipo" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_nome_key" ON "Perfil"("nome");


-- ─── Dados: perfis de fábrica = exatamente o que cada tipo de usuário podia fazer antes ───
INSERT INTO "Perfil" ("id", "nome", "descricao", "tipo", "permissoes", "somenteParticipa", "sistema", "createdAt", "updatedAt") VALUES
  ('perfil-gestor', 'Gestor', 'Acesso completo, inclusive Cadastros.', 'INTERNO',
   '["painel","minuta.escrever","contrato.gerenciar","projeto.gerenciar","projeto.reabrir","memorando.gerenciar","cadastros"]', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perfil-colaborador', 'Colaborador', 'Trabalha em contratos, projetos e minutas; sem acesso a Cadastros.', 'INTERNO',
   '["painel","minuta.escrever","contrato.gerenciar","projeto.gerenciar"]', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perfil-municipio', 'Município', 'Usuário da prefeitura: revisa minutas, dá parecer, assina e envia documentos.', 'EXTERNO',
   '["contrato.assinar","minuta.revisar","minuta.parecer","etapa.enviar"]', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "User" SET "perfilId" = 'perfil-gestor' WHERE "tipo" = 'INTERNO' AND "perfilInterno" = 'GESTOR';
UPDATE "User" SET "perfilId" = 'perfil-colaborador' WHERE "tipo" = 'INTERNO' AND "perfilId" IS NULL;
UPDATE "User" SET "perfilId" = 'perfil-municipio' WHERE "tipo" = 'EXTERNO';
