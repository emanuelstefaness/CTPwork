-- CreateTable
CREATE TABLE "MemorandoCiencia" (
    "memorandoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("memorandoId", "userId"),
    CONSTRAINT "MemorandoCiencia_memorandoId_fkey" FOREIGN KEY ("memorandoId") REFERENCES "Memorando" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemorandoCiencia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
