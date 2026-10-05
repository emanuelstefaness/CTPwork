"use client";

import { useRef } from "react";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useEnvio } from "@/components/use-envio";
import type { Resultado } from "@/lib/resultado";

/** Botão de envio de documento: escolher o arquivo já envia (com os campos ocultos informados). */
export function EnviarArquivo({ acao, campos, rotulo = "Enviar arquivo" }: {
  acao: (dados: FormData) => Promise<Resultado<unknown>>;
  campos: Record<string, string>;
  rotulo?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { onSubmit, pendente, erro } = useEnvio(acao);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col items-end gap-1">
      {Object.entries(campos).map(([nome, valor]) => <input key={nome} type="hidden" name={nome} value={valor} />)}
      <label className={`secondary-button min-h-8 cursor-pointer px-2.5 py-1 text-[11px] ${pendente ? "pointer-events-none opacity-60" : ""}`}>
        <ArrowUpTrayIcon className="h-3.5 w-3.5" />
        {pendente ? "Enviando…" : rotulo}
        <input
          type="file"
          name="arquivo"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          className="sr-only"
          onChange={(e) => { if (e.target.files?.length) formRef.current?.requestSubmit(); }}
        />
      </label>
      {erro && <p className="max-w-[220px] text-right text-[11px] text-red-600" role="alert">{erro}</p>}
    </form>
  );
}
