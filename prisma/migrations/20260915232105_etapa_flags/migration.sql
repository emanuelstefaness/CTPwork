-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EtapaProjeto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projetoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipoFluxo" TEXT NOT NULL,
    "modoRevisao" TEXT NOT NULL DEFAULT 'ARTIGO',
    "status" TEXT NOT NULL DEFAULT 'NAO_INICIADA',
    "prazo" DATETIME,
    "responsavelId" TEXT NOT NULL,
    "formularioConfigId" TEXT,
    "temInformacoesProjeto" BOOLEAN NOT NULL DEFAULT false,
    "temFormulario" BOOLEAN NOT NULL DEFAULT false,
    "temChecklist" BOOLEAN NOT NULL DEFAULT false,
    "temRevisao" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EtapaProjeto_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EtapaProjeto_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EtapaProjeto" ("createdAt", "formularioConfigId", "id", "modoRevisao", "nome", "ordem", "prazo", "projetoId", "responsavelId", "status", "tipoFluxo", "updatedAt") SELECT "createdAt", "formularioConfigId", "id", "modoRevisao", "nome", "ordem", "prazo", "projetoId", "responsavelId", "status", "tipoFluxo", "updatedAt" FROM "EtapaProjeto";
DROP TABLE "EtapaProjeto";
ALTER TABLE "new_EtapaProjeto" RENAME TO "EtapaProjeto";
CREATE INDEX "EtapaProjeto_projetoId_ordem_idx" ON "EtapaProjeto"("projetoId", "ordem");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
