-- Corrige o nome da etapa do tipo Padrão (e das cópias e contratos que ainda usam o nome original).
UPDATE "EtapaFluxoContrato" SET "nome" = 'Aprovação do orçamento' WHERE "chave" = 'APROVACAO_ORCAMENTO' AND "nome" = 'Aprovação orçamento';
UPDATE "EtapaContrato" SET "nome" = 'Aprovação do orçamento' WHERE "chave" = 'APROVACAO_ORCAMENTO' AND "nome" = 'Aprovação orçamento';
