// Converte para o editor os documentos de etapa que ainda estão no formato antigo (seções/artigos).
// Uso único após atualizar um banco existente:  npx tsx prisma/migrar-editor.ts
import { PrismaClient } from "@prisma/client";
import { migrarDocumentosParaEditor, semearRespostasDemo } from "./demo/editor";

const prisma = new PrismaClient();

migrarDocumentosParaEditor(prisma)
  .then(async (r) => {
    const respostas = await semearRespostasDemo(prisma);
    console.log("Documentos convertidos:", r, "respostas de demonstração:", respostas);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
