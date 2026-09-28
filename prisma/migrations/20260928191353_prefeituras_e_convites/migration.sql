-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FluxoContrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "municipioId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FluxoContrato_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FluxoContrato" ("ativo", "createdAt", "descricao", "id", "nome", "updatedAt") SELECT "ativo", "createdAt", "descricao", "id", "nome", "updatedAt" FROM "FluxoContrato";
DROP TABLE "FluxoContrato";
ALTER TABLE "new_FluxoContrato" RENAME TO "FluxoContrato";
CREATE UNIQUE INDEX "FluxoContrato_nome_key" ON "FluxoContrato"("nome");
CREATE TABLE "new_TipoProjetoModelo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "municipioId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TipoProjetoModelo_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TipoProjetoModelo" ("chave", "createdAt", "id", "nome", "updatedAt") SELECT "chave", "createdAt", "id", "nome", "updatedAt" FROM "TipoProjetoModelo";
DROP TABLE "TipoProjetoModelo";
ALTER TABLE "new_TipoProjetoModelo" RENAME TO "TipoProjetoModelo";
CREATE UNIQUE INDEX "TipoProjetoModelo_chave_key" ON "TipoProjetoModelo"("chave");
CREATE TABLE "new_TokenSenha" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "finalidade" TEXT NOT NULL DEFAULT 'REDEFINICAO',
    "expiraEm" DATETIME NOT NULL,
    "usadoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenSenha_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TokenSenha" ("createdAt", "expiraEm", "id", "tokenHash", "usadoEm", "userId") SELECT "createdAt", "expiraEm", "id", "tokenHash", "usadoEm", "userId" FROM "TokenSenha";
DROP TABLE "TokenSenha";
ALTER TABLE "new_TokenSenha" RENAME TO "TokenSenha";
CREATE UNIQUE INDEX "TokenSenha_tokenHash_key" ON "TokenSenha"("tokenHash");
CREATE INDEX "TokenSenha_userId_createdAt_idx" ON "TokenSenha"("userId", "createdAt");
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
    "convitePendente" BOOLEAN NOT NULL DEFAULT false,
    "desativadoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("ativo", "createdAt", "desativadoEm", "email", "id", "municipioId", "nome", "passwordHash", "perfilId", "perfilInterno", "receberEmail", "setorId", "tipo") SELECT "ativo", "createdAt", "desativadoEm", "email", "id", "municipioId", "nome", "passwordHash", "perfilId", "perfilInterno", "receberEmail", "setorId", "tipo" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
