-- AlterTable
ALTER TABLE "AnotacaoDocumento" ADD COLUMN "decisao" TEXT;
ALTER TABLE "AnotacaoDocumento" ADD COLUMN "sugestao" TEXT;

-- CreateTable
CREATE TABLE "Conversa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "municipioId" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "contratoId" TEXT,
    "projetoId" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "ultimaMensagemEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversa_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversa_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Conversa_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Conversa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MensagemConversa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "anexoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MensagemConversa_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MensagemConversa_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MensagemConversa_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "Anexo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeituraConversa" (
    "conversaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lidoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("conversaId", "userId"),
    CONSTRAINT "LeituraConversa_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeituraConversa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Conversa_municipioId_ultimaMensagemEm_idx" ON "Conversa"("municipioId", "ultimaMensagemEm");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemConversa_anexoId_key" ON "MensagemConversa"("anexoId");

-- CreateIndex
CREATE INDEX "MensagemConversa_conversaId_createdAt_idx" ON "MensagemConversa"("conversaId", "createdAt");
