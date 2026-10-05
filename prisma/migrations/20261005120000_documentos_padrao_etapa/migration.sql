-- Documentos pedidos por padrão no checklist de cada etapa do modelo de projeto.
ALTER TABLE "EtapaModelo" ADD COLUMN "documentosPadrao" TEXT NOT NULL DEFAULT '[]';
