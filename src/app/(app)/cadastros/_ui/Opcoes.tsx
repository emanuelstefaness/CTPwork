"use client";

import { useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { XMarkIcon, DocumentIcon, PlusIcon } from "@heroicons/react/24/outline";

type Icone = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Opção em cartão (rádio ou caixa de marcar) com título e uma frase do que ela faz. O input
 * continua nativo: acessível pelo teclado e enviado no FormData.
 */
export function CartaoOpcao({
  tipo = "checkbox",
  name,
  value,
  checked,
  defaultChecked,
  onChange,
  disabled,
  icone: IconeOpcao,
  titulo,
  descricao,
  children,
}: {
  tipo?: "checkbox" | "radio";
  name: string;
  value?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (marcado: boolean) => void;
  disabled?: boolean;
  icone?: Icone;
  titulo: string;
  descricao?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border bg-white transition-colors has-[:checked]:border-cyan-400 has-[:checked]:bg-cyan-50/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan-500 ${
        disabled ? "border-slate-100 opacity-60" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <label className={`flex items-start gap-2.5 px-3 py-2.5 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <input
          type={tipo}
          name={name}
          value={value}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-700"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            {IconeOpcao && <IconeOpcao className="h-4 w-4 shrink-0 text-slate-500" />}
            {titulo}
          </span>
          {descricao && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{descricao}</span>}
        </span>
      </label>
      {children && <div className="border-t border-cyan-100 px-3 pb-3 pt-2.5">{children}</div>}
    </div>
  );
}

/** Pergunta de um formulário de etapa: número, enunciado e as opções. */
export function Pergunta({ numero, titulo, ajuda, children }: { numero: number; titulo: string; ajuda?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">{numero}</span>
        {titulo}
      </legend>
      {ajuda && <p className="mt-1 pl-7 text-xs leading-5 text-slate-500">{ajuda}</p>}
      <div className="mt-2.5 flex flex-col gap-2 sm:pl-7">{children}</div>
    </fieldset>
  );
}

type PerfilOpcao = { id: string; nome: string };

/**
 * "Quem faz esta etapa no CTP": qualquer pessoa com a permissão do perfil, ou só alguns perfis.
 * Envia `conduzem` (TODOS | PERFIS) e os perfis marcados em `campo`.
 */
export function QuemFazNoCtp({
  campo,
  perfis,
  marcados,
  rotuloTodos,
  descricaoTodos,
}: {
  campo: string;
  perfis: PerfilOpcao[];
  marcados: string[];
  rotuloTodos: string;
  descricaoTodos: string;
}) {
  const [modo, setModo] = useState<"TODOS" | "PERFIS">(marcados.length ? "PERFIS" : "TODOS");
  return (
    <div className="flex flex-col gap-2">
      <CartaoOpcao tipo="radio" name="conduzem" value="TODOS" checked={modo === "TODOS"} onChange={() => setModo("TODOS")} titulo={rotuloTodos} descricao={descricaoTodos} />
      <CartaoOpcao tipo="radio" name="conduzem" value="PERFIS" checked={modo === "PERFIS"} onChange={() => setModo("PERFIS")} titulo="Só alguns perfis" descricao="Os demais veem a etapa, mas não mexem nela.">
        {modo === "PERFIS" && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Perfis que podem">
            {perfis.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 has-[:checked]:border-cyan-600 has-[:checked]:bg-cyan-600 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan-500"
              >
                <input type="checkbox" name={campo} value={p.id} defaultChecked={marcados.includes(p.id)} className="sr-only" />
                {p.nome}
              </label>
            ))}
          </div>
        )}
      </CartaoOpcao>
    </div>
  );
}

/**
 * Lista editável de documentos (um item por vez, com botão de tirar). Envia tudo num campo oculto,
 * um por linha — inclusive o que estiver digitado e ainda não adicionado.
 */
export function ListaDeDocumentos({
  name,
  inicial,
  rotulo,
  placeholder,
  vazio,
}: {
  name: string;
  inicial: string[];
  rotulo: string;
  placeholder: string;
  vazio: string;
}) {
  const [itens, setItens] = useState(inicial);
  const [rascunho, setRascunho] = useState("");

  function adicionar() {
    const nome = rascunho.trim().slice(0, 200);
    if (!nome) return;
    if (!itens.some((i) => i.toLowerCase() === nome.toLowerCase())) setItens([...itens, nome]);
    setRascunho("");
  }

  return (
    <div className="min-w-0">
      <input type="hidden" name={name} value={[...itens, rascunho.trim()].filter(Boolean).join("\n")} />
      {itens.length > 0 ? (
        <ul className="mb-2 flex flex-col gap-1">
          {itens.map((doc) => (
            <li key={doc} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-700 ring-1 ring-inset ring-slate-200">
              <DocumentIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate">{doc}</span>
              <button
                type="button"
                onClick={() => setItens(itens.filter((i) => i !== doc))}
                aria-label={`Tirar "${doc}" da lista`}
                className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-slate-400">{vazio}</p>
      )}
      <div className="flex gap-1.5">
        <input
          aria-label={rotulo}
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          maxLength={200}
          placeholder={placeholder}
          className="form-control min-w-0 flex-1 py-1.5 text-xs"
        />
        <button type="button" onClick={adicionar} className="secondary-button min-h-8 shrink-0 px-2.5 py-1 text-xs">
          <PlusIcon className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>
    </div>
  );
}
