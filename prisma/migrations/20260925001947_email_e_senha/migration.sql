-- AlterTable
ALTER TABLE "Notificacao" ADD COLUMN "emailStatus" TEXT;
-- Avisos que já existiam antes do envio por e-mail não são disparados retroativamente.
UPDATE "Notificacao" SET "emailStatus" = 'IGNORADO';

-- CreateTable
CREATE TABLE "TokenSenha" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" DATETIME NOT NULL,
    "usadoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenSenha_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "perfilInterno" TEXT,
    "setorId" TEXT,
    "municipioId" TEXT,
    "receberEmail" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "municipioId", "nome", "passwordHash", "perfilInterno", "setorId", "tipo") SELECT "createdAt", "email", "id", "municipioId", "nome", "passwordHash", "perfilInterno", "setorId", "tipo" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TokenSenha_tokenHash_key" ON "TokenSenha"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenSenha_userId_createdAt_idx" ON "TokenSenha"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notificacao_emailStatus_idx" ON "Notificacao"("emailStatus");
