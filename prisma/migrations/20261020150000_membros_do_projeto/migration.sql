-- CreateTable
CREATE TABLE "ProjetoMembro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projetoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "adicionadoPorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjetoMembro_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjetoMembro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjetoMembro_adicionadoPorId_fkey" FOREIGN KEY ("adicionadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProjetoMembro_userId_idx" ON "ProjetoMembro"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjetoMembro_projetoId_userId_key" ON "ProjetoMembro"("projetoId", "userId");

