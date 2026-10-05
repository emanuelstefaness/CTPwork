import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { semearConfiguracaoBase } from "./base";

// Banco limpo: só a configuração base (prisma/base.ts) e um administrador para o primeiro acesso.
// Sem prefeituras, contratos, projetos ou qualquer dado de exemplo.
//   npm run banco:limpo   (zera o banco e roda este arquivo)
// E-mail e senha do administrador: ADMIN_EMAIL / ADMIN_SENHA no ambiente, senão os padrões abaixo.
// Troque a senha em "Minha conta" no primeiro acesso.

const prisma = new PrismaClient();

async function main() {
  await semearConfiguracaoBase(prisma);

  const email = (process.env.ADMIN_EMAIL ?? "admin@ctp.org.br").trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA ?? "ctpwork123";
  const setor = await prisma.setor.findUniqueOrThrow({ where: { nome: "Administrativo" } });
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      nome: "Administrador",
      email,
      passwordHash: await bcrypt.hash(senha, 10),
      tipo: "INTERNO",
      perfilInterno: "GESTOR",
      perfilId: "perfil-gestor",
      setorId: setor.id,
    },
  });
  console.log(`Banco limpo pronto. Administrador: ${email} (troque a senha em Minha conta).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
