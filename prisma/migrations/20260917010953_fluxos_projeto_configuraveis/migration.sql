-- CreateTable
CREATE TABLE "TipoProjetoModelo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EtapaModelo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipoProjetoModeloId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "temInformacoesProjeto" BOOLEAN NOT NULL DEFAULT false,
    "temFormulario" BOOLEAN NOT NULL DEFAULT false,
    "temChecklist" BOOLEAN NOT NULL DEFAULT false,
    "temRevisao" BOOLEAN NOT NULL DEFAULT false,
    "modoRevisao" TEXT NOT NULL DEFAULT 'ARTIGO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EtapaModelo_tipoProjetoModeloId_fkey" FOREIGN KEY ("tipoProjetoModeloId") REFERENCES "TipoProjetoModelo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoProjetoModelo_chave_key" ON "TipoProjetoModelo"("chave");

-- CreateIndex
CREATE INDEX "EtapaModelo_tipoProjetoModeloId_ordem_idx" ON "EtapaModelo"("tipoProjetoModeloId", "ordem");
