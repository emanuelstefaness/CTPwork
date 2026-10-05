"use client";

import { useState } from "react";
import Link from "next/link";
import { useEnvio } from "@/components/use-envio";
import { limiteAnexoTexto } from "@/lib/limite-anexo";
import { iniciarConversa } from "@/lib/actions/conversas";
import { ExclamationCircleIcon, PaperAirplaneIcon, PaperClipIcon } from "@heroicons/react/24/outline";

type Vinculo = { valor: string; rotulo: string; grupo: string; municipioId: string };

export default function NovaConversaForm({
  isInterno,
  municipios,
  vinculos,
  municipioInicial,
  vinculoInicial,
}: {
  isInterno: boolean;
  municipios: { id: string; nome: string }[];
  vinculos: Vinculo[];
  municipioInicial: string;
  vinculoInicial: string;
}) {
  const [municipioId, setMunicipioId] = useState(municipioInicial);
  const [vinculo, setVinculo] = useState(vinculoInicial);
  const [arquivo, setArquivo] = useState<string | null>(null);
  // Sucesso redireciona para a conversa criada.
  const { onSubmit, pendente, erro } = useEnvio(iniciarConversa, () => {});

  const disponiveis = isInterno ? vinculos.filter((v) => v.municipioId === municipioId) : vinculos;
  const grupos = [...new Set(disponiveis.map((v) => v.grupo))];

  return (
    <form onSubmit={onSubmit} className="surface-panel">
      <div className="flex flex-col gap-5 px-6 py-6">
        {isInterno && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Município</span>
            <select
              name="municipioId"
              required
              value={municipioId}
              onChange={(e) => { setMunicipioId(e.target.value); setVinculo(""); }}
              className="form-control"
            >
              <option value="" disabled>Selecione o município</option>
              {municipios.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Assunto</span>
          <input name="assunto" required maxLength={160} className="form-control" placeholder={isInterno ? "Ex.: Agendamento da audiência pública" : "Ex.: Dúvida sobre o cronograma de pagamentos"} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Sobre qual contrato ou projeto? <span className="font-normal text-slate-400">(opcional)</span></span>
          <select name="vinculo" value={vinculo} onChange={(e) => setVinculo(e.target.value)} className="form-control" disabled={isInterno && !municipioId}>
            <option value="">{isInterno && !municipioId ? "Selecione o município primeiro" : "Assunto geral"}</option>
            {grupos.map((g) => (
              <optgroup key={g} label={g}>
                {disponiveis.filter((v) => v.grupo === g).map((v) => <option key={v.valor} value={v.valor}>{v.rotulo}</option>)}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Mensagem</span>
          <textarea name="texto" required rows={7} maxLength={10000} className="form-control" placeholder="Escreva com o máximo de contexto possível." />
        </label>

        <label className="flex cursor-pointer items-center gap-2 self-start rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-sm text-slate-600 hover:border-cyan-400 hover:bg-cyan-50/40">
          <PaperClipIcon className="h-4 w-4 text-slate-400" />
          {arquivo ?? `Anexar arquivo (PDF, Word, Excel ou imagem, até ${limiteAnexoTexto()})`}
          <input type="file" name="arquivo" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" className="sr-only" onChange={(e) => setArquivo(e.target.files?.[0]?.name ?? null)} />
        </label>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {erro ? (
          <p className="flex items-center gap-1.5 text-sm text-red-600" role="alert"><ExclamationCircleIcon className="h-4 w-4 shrink-0" />{erro}</p>
        ) : (
          <p className="text-xs text-slate-400">{isInterno ? "Os usuários do município recebem uma notificação." : "A equipe do CTP recebe uma notificação."}</p>
        )}
        <div className="flex gap-2 sm:justify-end">
          <Link href="/conversas" className="secondary-button">Cancelar</Link>
          <button type="submit" disabled={pendente} className="primary-button">
            <PaperAirplaneIcon className="h-4 w-4" />
            {pendente ? "Enviando…" : "Iniciar conversa"}
          </button>
        </div>
      </div>
    </form>
  );
}
