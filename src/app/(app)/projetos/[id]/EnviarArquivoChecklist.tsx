"use client";

import { EnviarArquivo } from "@/components/enviar-arquivo";
import { enviarArquivoChecklistSeguro } from "@/lib/actions/formularios";

/** Envio de documento do checklist pelo município: escolher o arquivo já envia. */
export function EnviarArquivoChecklist({ itemId }: { itemId: string }) {
  return <EnviarArquivo acao={enviarArquivoChecklistSeguro} campos={{ itemId }} />;
}
