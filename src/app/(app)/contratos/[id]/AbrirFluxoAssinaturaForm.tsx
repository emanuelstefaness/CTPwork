"use client";

import { useEnvio } from "@/components/use-envio";
import { DocumentCheckIcon } from "@heroicons/react/24/outline";
import { iniciarAssinaturaContratoSeguro } from "@/lib/actions/formularios";
import { PessoasChips } from "@/components/pessoas-chips";

type Usuario = { id: string; nome: string };

function BotaoAbrir({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="primary-button self-start">
      <DocumentCheckIcon className="h-4 w-4" />
      {pending ? "Abrindo..." : "Abrir fluxo de assinatura"}
    </button>
  );
}

export default function AbrirFluxoAssinaturaForm({ contratoId, usuariosInternos }: { contratoId: string; usuariosInternos: Usuario[] }) {
  const { onSubmit, pendente, erro } = useEnvio(iniciarAssinaturaContratoSeguro, () => {});

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="contratoId" value={contratoId} />
      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Signatários internos (CTP)</span>
        <PessoasChips name="internoIds" pessoas={usuariosInternos} />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Signatário externo (município)</span>
        <input name="nomeExterno" placeholder="Nome do representante do município" className="form-control" />
      </label>
      {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}
      <BotaoAbrir pending={pendente} />
    </form>
  );
}
