"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { avancarEtapaContratoSeguro } from "@/lib/actions/formularios";

function BotaoAvancar({ proximaEtapaNome }: { proximaEtapaNome: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="primary-button">
      {pending ? "Avançando..." : <>Avançar para {proximaEtapaNome}</>} <ArrowRightIcon className="h-4 w-4" />
    </button>
  );
}

export default function AvancarEtapaForm({
  contratoId,
  proximaEtapaNome,
  bloqueado,
  motivoBloqueio,
}: {
  contratoId: string;
  proximaEtapaNome: string;
  bloqueado?: boolean;
  motivoBloqueio?: string;
}) {
  const [erro, setErro] = useState<string | null>(null);

  async function action() {
    setErro(null);
    try {
      const r = await avancarEtapaContratoSeguro(contratoId);
      if (!r.ok) setErro(r.erro);
    } catch {
      setErro("Não foi possível avançar a etapa. Verifique sua conexão e tente de novo.");
    }
  }

  if (bloqueado) {
    return (
      <div>
        <button disabled className="primary-button">
          Avançar para {proximaEtapaNome} <ArrowRightIcon className="h-4 w-4" />
        </button>
        {motivoBloqueio && <p className="mt-2 text-xs text-slate-500">{motivoBloqueio}</p>}
      </div>
    );
  }

  return (
    <form action={action}>
      <BotaoAvancar proximaEtapaNome={proximaEtapaNome} />
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </form>
  );
}
