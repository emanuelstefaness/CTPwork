"use client";

import type { Resultado } from "@/lib/resultado";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEnvio } from "@/components/use-envio";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

type Campo = { id: number; chave: string; label: string; tipo: string; obrigatorio: boolean };
type Modelo = { id: string; nome: string; tipo: string; campos: Omit<Campo, "id">[] };

let proximoId = 0;
const novoCampo = (): Campo => ({ id: proximoId++, chave: "", label: "", tipo: "text", obrigatorio: false });

/**
 * Campos de um formulário (memorando ou etapas de projeto). A chave interna de cada campo fica
 * oculta: nasce do rótulo no servidor e não muda quando o campo é renomeado.
 */
export default function FormularioEditor({
  tipo,
  modelo,
  acao,
  voltarPara,
}: {
  tipo: "MEMORANDO" | "CONTRATO";
  modelo?: Modelo;
  acao: (formData: FormData) => Promise<Resultado<unknown>>;
  voltarPara: string;
}) {
  const router = useRouter();
  const [campos, setCampos] = useState<Campo[]>(() => (modelo?.campos.length ? modelo.campos.map((c) => ({ ...c, id: proximoId++ })) : [novoCampo()]));
  const { onSubmit, pendente, erro } = useEnvio(acao, () => router.replace(voltarPara, { scroll: false }));

  const atualizar = (id: number, patch: Partial<Campo>) => setCampos((lista) => lista.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const mover = (i: number, delta: number) =>
    setCampos((lista) => {
      const nova = [...lista];
      [nova[i], nova[i + delta]] = [nova[i + delta], nova[i]];
      return nova;
    });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {modelo ? <input type="hidden" name="modeloId" value={modelo.id} /> : <input type="hidden" name="tipo" value={tipo} />}

      <label className="text-xs font-semibold text-slate-600">
        Nome do formulário
        <input
          name="nome" required maxLength={120} defaultValue={modelo?.nome}
          placeholder={tipo === "MEMORANDO" ? "Ex.: Solicitação de sala de reunião" : "Ex.: Dados iniciais do município"}
          className="form-control mt-1 py-2 text-sm"
        />
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Campos</p>
        <ol className="flex flex-col gap-2">
          {campos.map((campo, i) => (
            <li key={campo.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto_auto] sm:items-center">
              {/* Campo existente mantém a chave em que as respostas já estão gravadas. */}
              <input type="hidden" name="campoChave" value={campo.chave} />
              <input type="hidden" name="campoTipo" value={campo.tipo} />
              <input
                name="campoLabel" required maxLength={120} value={campo.label}
                onChange={(e) => atualizar(campo.id, { label: e.target.value })}
                placeholder="Pergunta (ex.: Data de uso)" aria-label={`Pergunta ${i + 1}`}
                className="form-control py-2 text-sm"
              />
              <select value={campo.tipo} onChange={(e) => atualizar(campo.id, { tipo: e.target.value })} aria-label={`Tipo da resposta ${i + 1}`} className="form-control py-2 text-sm">
                <option value="text">Texto curto</option>
                <option value="textarea">Texto longo</option>
                <option value="date">Data</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <input type="checkbox" name="campoObrigatorio" value={i} checked={campo.obrigatorio} onChange={(e) => atualizar(campo.id, { obrigatorio: e.target.checked })} className="h-3.5 w-3.5" />
                Obrigatório
              </label>
              <span className="flex items-center justify-end gap-0.5">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir campo" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ChevronUpIcon className="h-4 w-4" /></button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === campos.length - 1} aria-label="Descer campo" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ChevronDownIcon className="h-4 w-4" /></button>
                <button type="button" onClick={() => setCampos((l) => l.filter((c) => c.id !== campo.id))} disabled={campos.length === 1} aria-label="Remover campo" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><TrashIcon className="h-4 w-4" /></button>
              </span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setCampos((l) => [...l, novoCampo()])} className="secondary-button mt-2 min-h-8 py-1.5 text-xs">
          <PlusIcon className="h-3.5 w-3.5" />Adicionar campo
        </button>
      </div>

      {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pendente} className="primary-button">{pendente ? "Salvando..." : modelo ? "Salvar formulário" : "Criar formulário"}</button>
        <button type="button" onClick={() => router.replace(voltarPara, { scroll: false })} className="secondary-button">Cancelar</button>
      </div>
    </form>
  );
}
