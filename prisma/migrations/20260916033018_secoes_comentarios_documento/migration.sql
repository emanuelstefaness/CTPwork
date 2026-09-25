-- CreateTable
CREATE TABLE "SecaoDocumento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecaoDocumento_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoVersionado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComentarioDocumento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secaoId" TEXT NOT NULL,
    "trechoInicio" INTEGER NOT NULL,
    "trechoFim" INTEGER NOT NULL,
    "trechoTexto" TEXT NOT NULL,
    "comentario" TEXT NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "autorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComentarioDocumento_secaoId_fkey" FOREIGN KEY ("secaoId") REFERENCES "SecaoDocumento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComentarioDocumento_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SecaoDocumento_documentoId_ordem_idx" ON "SecaoDocumento"("documentoId", "ordem");

-- CreateIndex
CREATE INDEX "ComentarioDocumento_secaoId_idx" ON "ComentarioDocumento"("secaoId");
