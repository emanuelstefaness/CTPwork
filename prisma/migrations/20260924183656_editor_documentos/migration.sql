-- CreateTable
CREATE TABLE "AnotacaoDocumento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "de" INTEGER NOT NULL,
    "ate" INTEGER NOT NULL,
    "trecho" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cor" TEXT,
    "texto" TEXT,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "resolvidoPorId" TEXT,
    "resolvidoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnotacaoDocumento_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoVersionado" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnotacaoDocumento_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnotacaoDocumento_resolvidoPorId_fkey" FOREIGN KEY ("resolvidoPorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RespostaAnotacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "anotacaoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RespostaAnotacao_anotacaoId_fkey" FOREIGN KEY ("anotacaoId") REFERENCES "AnotacaoDocumento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RespostaAnotacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DocumentoVersionado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "etapaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "titulo" TEXT,
    "nomeArquivo" TEXT NOT NULL,
    "arquivoId" TEXT,
    "conteudo" TEXT,
    "enviadoEm" DATETIME,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentoVersionado_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "EtapaProjeto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentoVersionado_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "Anexo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Versões anteriores ao editor já tinham sido enviadas ao município: enviadoEm = createdAt.
INSERT INTO "new_DocumentoVersionado" ("arquivoId", "createdAt", "criadoPorId", "etapaId", "id", "nomeArquivo", "versao", "enviadoEm", "updatedAt") SELECT "arquivoId", "createdAt", "criadoPorId", "etapaId", "id", "nomeArquivo", "versao", "createdAt", "createdAt" FROM "DocumentoVersionado";
DROP TABLE "DocumentoVersionado";
ALTER TABLE "new_DocumentoVersionado" RENAME TO "DocumentoVersionado";
CREATE UNIQUE INDEX "DocumentoVersionado_arquivoId_key" ON "DocumentoVersionado"("arquivoId");
CREATE INDEX "DocumentoVersionado_etapaId_versao_idx" ON "DocumentoVersionado"("etapaId", "versao");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AnotacaoDocumento_documentoId_idx" ON "AnotacaoDocumento"("documentoId");

-- CreateIndex
CREATE INDEX "RespostaAnotacao_anotacaoId_idx" ON "RespostaAnotacao"("anotacaoId");
