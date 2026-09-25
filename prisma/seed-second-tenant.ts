import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const senha = await bcrypt.hash("ctpwork123", 10);

  const municipio = await prisma.municipio.upsert({
    where: { id: "municipio-demo-2" },
    update: {},
    create: {
      id: "municipio-demo-2",
      nome: "Prefeitura Municipal de Vale Verde",
      contatoNome: "Gabinete do Prefeito",
      contatoEmail: "gabinete@valeverde.mg.gov.br",
    },
  });

  await prisma.user.upsert({
    where: { email: "municipio@valeverde.mg.gov.br" },
    update: {},
    create: {
      nome: "Prefeito(a) de Vale Verde",
      email: "municipio@valeverde.mg.gov.br",
      passwordHash: senha,
      tipo: "EXTERNO",
      municipioId: municipio.id,
    },
  });

  const gestor = await prisma.user.findFirstOrThrow({ where: { email: "gestor@ctp.org.br" } });

  const contrato = await prisma.contrato.upsert({
    where: { codigo: "SEED-VV-000001" },
    update: {},
    create: {
      codigo: "SEED-VV-000001",
      objeto: "Elaboração de Plano Diretor de Vale Verde",
      contratanteId: municipio.id,
      responsavelId: gestor.id,
      etapaAtual: "PEDIDO_ORCAMENTO",
    },
  });

  console.log("Segundo tenant criado:", { municipioId: municipio.id, contratoId: contrato.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
