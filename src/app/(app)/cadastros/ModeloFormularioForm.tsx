"use client";

import type { Resultado } from "@/lib/resultado";
import { useState } from "react";
import { useEnvio } from "@/components/use-envio";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

type Campo = { chave: string; label: string; tipo: string; obrigatorio: boolean };
type Modelo = { id: string; nome: string; tipo: string; campos: Campo[] };

function BotaoSalvar({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="primary-button">
      {pending ? "Salvando..." : label}
    </button>
  );
}

export default function ModeloFormularioForm({
  modo,
  modelo,
  action,
}: {
  modo: "criar" | "editar";
  modelo?: Modelo;
  action: (formData: FormData) => Promise<Resultado<unknown>>;
}) {
  const [campos, setCampos] = useState<Campo[]>(modelo?.campos ?? [{ chave: "", label: "", tipo: "text", obrigatorio: false }]);
  // No sucesso de um modelo novo, volta à lista limpa de campos.
  const { onSubmit, pendente, erro } = useEnvio(action, (form) => {
    if (modo === "criar") {
      form.reset();
      setCampos([{ chave: "", label: "", tipo: "text", obrigatorio: false }]);
    }
  });

  function atualizarCampo(i: number, patch: Partial<Campo>) {
    setCampos((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removerCampo(i: number) {
    setCampos((prev) => prev.filter((_, idx) => idx !== i));
  }
  function adicionarCampo() {
    setCampos((prev) => [...prev, { chave: "", label: "", tipo: "text", obrigatorio: false }]);
  }


  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {modelo && <input type="hidden" name="modeloId" value={modelo.id} />}

      <label className="text-xs font-semibold text-slate-600">
        Nome do modelo
        <input name="nome" required defaultValue={modelo?.nome} placeholder="Ex.: Solicitação de sala de reunião" className="form-control mt-1 py-2 text-sm" />
      </label>

      {modo === "criar" ? (
        <label className="text-xs font-semibold text-slate-600">
          Usado em
          <select name="tipo" defaultValue={modelo?.tipo ?? "MEMORANDO"} className="form-control mt-1 py-2 text-sm">
            <option value="MEMORANDO">Memorando</option>
            <option value="CONTRATO">Contrato</option>
          </select>
        </label>
      ) : (
        <p className="text-xs text-slate-400">Usado em: {modelo?.tipo === "MEMORANDO" ? "Memorando" : "Contrato"} (não pode ser alterado)</p>
      )}

      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-600">Campos do formulário</p>
        <div className="flex flex-col gap-2">
          {campos.map((campo, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-slate-200 p-2.5">
              <div className="flex gap-1.5">
                <input
                  name="campoLabel"
                  required
                  value={campo.label}
                  onChange={(e) => atualizarCampo(i, { label: e.target.value })}
                  placeholder="Rótulo (ex.: Data de uso)"
                  className="form-control flex-1 py-1.5 text-xs"
                />
                <button type="button" onClick={() => removerCampo(i)} className="shrink-0 rounded-lg border border-slate-200 px-2 text-slate-400 hover:border-red-200 hover:text-red-600" aria-label="Remover campo">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                name="campoChave"
                required
                value={campo.chave}
                onChange={(e) => atualizarCampo(i, { chave: e.target.value })}
                placeholder="Chave interna (ex.: data_uso)"
                className="form-control py-1.5 text-xs"
              />
              <div className="flex items-center gap-3">
                <select name="campoTipo" value={campo.tipo} onChange={(e) => atualizarCampo(i, { tipo: e.target.value })} className="form-control flex-1 py-1.5 text-xs">
                  <option value="text">Texto curto</option>
                  <option value="textarea">Texto longo</option>
                  <option value="date">Data</option>
                </select>
                <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-slate-600">
                  <input type="checkbox" name="campoObrigatorio" value={i} checked={campo.obrigatorio} onChange={(e) => atualizarCampo(i, { obrigatorio: e.target.checked })} />
                  Obrigatório
                </label>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={adicionarCampo} className="secondary-button mt-2 min-h-8 w-full py-1.5 text-xs">
          <PlusIcon className="h-3.5 w-3.5" />
          Adicionar campo
        </button>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <BotaoSalvar pending={pendente} label={modo === "criar" ? "Criar modelo" : "Salvar alterações"} />
    </form>
  );
}
