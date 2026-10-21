-- Quem conduz cada etapa de projeto no CTP (ids de perfis; vazio = quem conduz etapas no projeto).
ALTER TABLE "EtapaModelo" ADD COLUMN "perfisQueConduzem" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "EtapaProjeto" ADD COLUMN "perfisQueConduzem" TEXT NOT NULL DEFAULT '[]';
