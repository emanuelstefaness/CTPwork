-- CreateTable
CREATE TABLE "FluxoContrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EtapaFluxoContrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fluxoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "curto" TEXT NOT NULL,
    "exigeAssinaturas" BOOLEAN NOT NULL DEFAULT false,
    "liberaProjeto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EtapaFluxoContrato_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES "FluxoContrato" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EtapaContrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contratoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "curto" TEXT NOT NULL,
    "exigeAssinaturas" BOOLEAN NOT NULL DEFAULT false,
    "liberaProjeto" BOOLEAN NOT NULL DEFAULT false,
    "concluidaEm" DATETIME,
    "concluidaPorId" TEXT,
    CONSTRAINT "EtapaContrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EtapaContrato_concluidaPorId_fkey" FOREIGN KEY ("concluidaPorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "objeto" TEXT NOT NULL,
    "contratanteId" TEXT NOT NULL,
    "etapaAtual" TEXT NOT NULL,
    "fluxoId" TEXT,
    "responsavelId" TEXT NOT NULL,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contrato_contratanteId_fkey" FOREIGN KEY ("contratanteId") REFERENCES "Municipio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contrato_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES "FluxoContrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contrato_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Contrato" ("codigo", "contratanteId", "createdAt", "etapaAtual", "id", "objeto", "responsavelId", "tags", "updatedAt") SELECT "codigo", "contratanteId", "createdAt", "etapaAtual", "id", "objeto", "responsavelId", "tags", "updatedAt" FROM "Contrato";
DROP TABLE "Contrato";
ALTER TABLE "new_Contrato" RENAME TO "Contrato";
CREATE UNIQUE INDEX "Contrato_codigo_key" ON "Contrato"("codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FluxoContrato_nome_key" ON "FluxoContrato"("nome");

-- CreateIndex
CREATE INDEX "EtapaFluxoContrato_fluxoId_ordem_idx" ON "EtapaFluxoContrato"("fluxoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "EtapaFluxoContrato_fluxoId_chave_key" ON "EtapaFluxoContrato"("fluxoId", "chave");

-- CreateIndex
CREATE INDEX "EtapaContrato_contratoId_ordem_idx" ON "EtapaContrato"("contratoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "EtapaContrato_contratoId_chave_key" ON "EtapaContrato"("contratoId", "chave");


-- ─── Dados: fluxo "Padrão" = as 6 etapas que eram fixas no código ───
INSERT INTO "FluxoContrato" ("id", "nome", "descricao", "ativo", "createdAt", "updatedAt") VALUES
  ('fluxo-contrato-padrao', 'Padrão', 'Do pedido de orçamento à assinatura do contrato e termo de referência.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "EtapaFluxoContrato" ("id", "fluxoId", "ordem", "chave", "nome", "curto", "exigeAssinaturas", "liberaProjeto") VALUES
  ('efc-padrao-1', 'fluxo-contrato-padrao', 0, 'PEDIDO_ORCAMENTO', 'Pedido de orçamento', 'Pedido', false, false),
  ('efc-padrao-2', 'fluxo-contrato-padrao', 1, 'EMISSAO_ORCAMENTO', 'Emissão de orçamento', 'Orçamento', false, false),
  ('efc-padrao-3', 'fluxo-contrato-padrao', 2, 'APROVACAO_ORCAMENTO', 'Aprovação orçamento', 'Aprovação', false, false),
  ('efc-padrao-4', 'fluxo-contrato-padrao', 3, 'DOCUMENTOS_CONTRATACAO', 'Documentos para contratação', 'Documentos', false, false),
  ('efc-padrao-5', 'fluxo-contrato-padrao', 4, 'TERMO_REFERENCIA_MINUTA', 'Contrato e termo de referência — minuta', 'Minuta', true, false),
  ('efc-padrao-6', 'fluxo-contrato-padrao', 5, 'TERMO_REFERENCIA_ASSINADO', 'Contrato e termo de referência — assinado', 'Assinado', false, true);

-- Contratos existentes passam a seguir o fluxo Padrão, com as etapas copiadas.
UPDATE "Contrato" SET "fluxoId" = 'fluxo-contrato-padrao' WHERE "fluxoId" IS NULL;

INSERT INTO "EtapaContrato" ("id", "contratoId", "ordem", "chave", "nome", "curto", "exigeAssinaturas", "liberaProjeto")
SELECT c."id" || '-' || e."chave", c."id", e."ordem", e."chave", e."nome", e."curto", e."exigeAssinaturas", e."liberaProjeto"
FROM "Contrato" c CROSS JOIN "EtapaFluxoContrato" e
WHERE e."fluxoId" = 'fluxo-contrato-padrao';
