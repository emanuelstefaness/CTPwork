-- CreateTable
CREATE TABLE "DocumentoContrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contratoId" TEXT NOT NULL,
    "etapaChave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "enviaQuem" TEXT NOT NULL DEFAULT 'PREFEITURA',
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "motivoRecusa" TEXT,
    "anexoId" TEXT,
    "enviadoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentoContrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentoContrato_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "Anexo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "concluidaPelaPrefeitura" BOOLEAN NOT NULL DEFAULT false,
    "motivoDevolucao" TEXT,
    "concluidaEm" DATETIME,
    "concluidaPorId" TEXT,
    CONSTRAINT "EtapaContrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EtapaContrato_concluidaPorId_fkey" FOREIGN KEY ("concluidaPorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EtapaContrato" ("chave", "concluidaEm", "concluidaPorId", "contratoId", "curto", "exigeAssinaturas", "id", "liberaProjeto", "nome", "ordem", "perfisQueAvancam") SELECT "chave", "concluidaEm", "concluidaPorId", "contratoId", "curto", "exigeAssinaturas", "id", "liberaProjeto", "nome", "ordem", "perfisQueAvancam" FROM "EtapaContrato";
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
    "documentosPadrao" TEXT NOT NULL DEFAULT '[]',
    "concluidaPelaPrefeitura" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EtapaFluxoContrato_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES "FluxoContrato" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EtapaFluxoContrato" ("chave", "createdAt", "curto", "exigeAssinaturas", "fluxoId", "id", "liberaProjeto", "nome", "ordem", "perfisQueAvancam") SELECT "chave", "createdAt", "curto", "exigeAssinaturas", "fluxoId", "id", "liberaProjeto", "nome", "ordem", "perfisQueAvancam" FROM "EtapaFluxoContrato";
DROP TABLE "EtapaFluxoContrato";
ALTER TABLE "new_EtapaFluxoContrato" RENAME TO "EtapaFluxoContrato";
CREATE INDEX "EtapaFluxoContrato_fluxoId_ordem_idx" ON "EtapaFluxoContrato"("fluxoId", "ordem");
CREATE UNIQUE INDEX "EtapaFluxoContrato_fluxoId_chave_key" ON "EtapaFluxoContrato"("fluxoId", "chave");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoContrato_anexoId_key" ON "DocumentoContrato"("anexoId");

-- CreateIndex
CREATE INDEX "DocumentoContrato_contratoId_etapaChave_idx" ON "DocumentoContrato"("contratoId", "etapaChave");


-- Documentos pedidos por padrão nas etapas do tipo Padrão (e das cópias dele, que usam as mesmas chaves).
UPDATE "EtapaFluxoContrato" SET "documentosPadrao" = '[{"nome":"Proposta de orçamento","enviaQuem":"CTP"}]'
WHERE "chave" = 'EMISSAO_ORCAMENTO' AND "documentosPadrao" = '[]';
UPDATE "EtapaFluxoContrato" SET "documentosPadrao" = '[{"nome":"Termo de referência assinado","enviaQuem":"PREFEITURA"},{"nome":"Declaração de dotação orçamentária","enviaQuem":"PREFEITURA"},{"nome":"Portaria de designação do fiscal do contrato","enviaQuem":"PREFEITURA"},{"nome":"Certidões de regularidade fiscal e trabalhista","enviaQuem":"CTP"},{"nome":"Contrato social e cartão CNPJ","enviaQuem":"CTP"}]'
WHERE "chave" = 'DOCUMENTOS_CONTRATACAO' AND "documentosPadrao" = '[]';

-- A aprovação do orçamento é da prefeitura, não do CTP.
UPDATE "EtapaFluxoContrato" SET "concluidaPelaPrefeitura" = true WHERE "chave" = 'APROVACAO_ORCAMENTO';
UPDATE "EtapaContrato" SET "concluidaPelaPrefeitura" = true WHERE "chave" = 'APROVACAO_ORCAMENTO';

-- Nova permissão da prefeitura: o perfil de fábrica "Município" passa a aprovar etapas do contrato.
UPDATE "Perfil" SET "permissoes" = substr("permissoes", 1, length("permissoes") - 1) || ',"contrato.aprovar"]'
WHERE "id" = 'perfil-municipio' AND "permissoes" LIKE '[%"%]' AND "permissoes" NOT LIKE '%contrato.aprovar%';
