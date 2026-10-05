-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TokenSenha" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
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

