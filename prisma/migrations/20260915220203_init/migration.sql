-- CreateTable
CREATE TABLE "Setor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Municipio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "contatoNome" TEXT,
    "contatoEmail" TEXT,
    "contatoFone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "perfilInterno" TEXT,
    "setorId" TEXT,
    "municipioId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModeloFormulario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "campos" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Memorando" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "acUserId" TEXT,
    "assunto" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "modeloId" TEXT,
    "camposModelo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "criadoPorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Memorando_acUserId_fkey" FOREIGN KEY ("acUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Memorando_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "ModeloFormulario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Memorando_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemorandoSetor" (
    "memorandoId" TEXT NOT NULL,
    "setorId" TEXT NOT NULL,

    PRIMARY KEY ("memorandoId", "setorId"),
    CONSTRAINT "MemorandoSetor_memorandoId_fkey" FOREIGN KEY ("memorandoId") REFERENCES "Memorando" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemorandoSetor_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "objeto" TEXT NOT NULL,
    "contratanteId" TEXT NOT NULL,
    "etapaAtual" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contrato_contratanteId_fkey" FOREIGN KEY ("contratanteId") REFERENCES "Municipio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contrato_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Projeto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "contratanteId" TEXT NOT NULL,
    "contratoOrigemId" TEXT NOT NULL,
    "dataVigencia" DATETIME NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Projeto_contratanteId_fkey" FOREIGN KEY ("contratanteId") REFERENCES "Municipio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Projeto_contratoOrigemId_fkey" FOREIGN KEY ("contratoOrigemId") REFERENCES "Contrato" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Projeto_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventoCronograma" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projetoId" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavelNome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoCronograma_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EtapaProjeto" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EtapaProjeto_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EtapaProjeto_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormularioResposta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "etapaId" TEXT NOT NULL,
    "respostas" TEXT NOT NULL,
    "enviadoPorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FormularioResposta_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "EtapaProjeto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "etapaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "arquivoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistItem_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "EtapaProjeto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistItem_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "Anexo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentoVersionado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "etapaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentoVersionado_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "EtapaProjeto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentoVersionado_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "Anexo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnidadeRevisao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "trechoInicio" INTEGER,
    "trechoFim" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "comentario" TEXT,
    "autorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnidadeRevisao_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoVersionado" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnidadeRevisao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MensagemChat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "etapaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "anexoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MensagemChat_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "EtapaProjeto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MensagemChat_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MensagemChat_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "Anexo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Anexo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nomeOriginal" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memorandoId" TEXT,
    "contratoId" TEXT,
    CONSTRAINT "Anexo_memorandoId_fkey" FOREIGN KEY ("memorandoId") REFERENCES "Memorando" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Anexo_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FluxoAssinatura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memorandoId" TEXT,
    "contratoId" TEXT,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FluxoAssinatura_memorandoId_fkey" FOREIGN KEY ("memorandoId") REFERENCES "Memorando" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FluxoAssinatura_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Signatario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fluxoId" TEXT NOT NULL,
    "userId" TEXT,
    "nomeExterno" TEXT,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "assinadoEm" DATETIME,
    "ipAssinatura" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signatario_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES "FluxoAssinatura" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Signatario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "entidadeTipo" TEXT,
    "entidadeId" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notificacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "detalhe" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Setor_nome_key" ON "Setor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Memorando_codigo_key" ON "Memorando"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_codigo_key" ON "Contrato"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Projeto_codigo_key" ON "Projeto"("codigo");

-- CreateIndex
CREATE INDEX "EtapaProjeto_projetoId_ordem_idx" ON "EtapaProjeto"("projetoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "FormularioResposta_etapaId_key" ON "FormularioResposta"("etapaId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_arquivoId_key" ON "ChecklistItem"("arquivoId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoVersionado_arquivoId_key" ON "DocumentoVersionado"("arquivoId");

-- CreateIndex
CREATE INDEX "DocumentoVersionado_etapaId_versao_idx" ON "DocumentoVersionado"("etapaId", "versao");

-- CreateIndex
CREATE INDEX "UnidadeRevisao_documentoId_idx" ON "UnidadeRevisao"("documentoId");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemChat_anexoId_key" ON "MensagemChat"("anexoId");

-- CreateIndex
CREATE INDEX "MensagemChat_etapaId_createdAt_idx" ON "MensagemChat"("etapaId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FluxoAssinatura_memorandoId_key" ON "FluxoAssinatura"("memorandoId");

-- CreateIndex
CREATE UNIQUE INDEX "FluxoAssinatura_contratoId_key" ON "FluxoAssinatura"("contratoId");

-- CreateIndex
CREATE INDEX "Notificacao_userId_lida_idx" ON "Notificacao"("userId", "lida");

-- CreateIndex
CREATE INDEX "AuditLog_entidadeTipo_entidadeId_idx" ON "AuditLog"("entidadeTipo", "entidadeId");
