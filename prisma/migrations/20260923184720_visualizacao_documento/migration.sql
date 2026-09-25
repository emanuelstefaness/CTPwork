-- CreateTable
CREATE TABLE "VisualizacaoDocumento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "visualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisualizacaoDocumento_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoVersionado" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisualizacaoDocumento_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VisualizacaoDocumento_documentoId_userId_key" ON "VisualizacaoDocumento"("documentoId", "userId");
