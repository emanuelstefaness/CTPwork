"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useEnvio } from "@/components/use-envio";
import { criarMemorandoSeguro } from "@/lib/actions/formularios";
import { PessoasChips } from "@/components/pessoas-chips";
import { CheckIcon, ExclamationCircleIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";

type Setor = { id: string; nome: string };
type Usuario = { id: string; nome: string; setorId: string | null; setorNome: string | null };
type CampoModelo = { chave: string; label: string; tipo: string; obrigatorio: boolean };
type Modelo = { id: string; nome: string; campos: CampoModelo[] };

function Secao({ numero, titulo, descricao, children }: { numero: number; titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-slate-100 px-6 py-6 last:border-b-0 md:grid-cols-[200px_minmax(0,1fr)]">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-cyan-50 text-[11px] font-bold text-cyan-700">{numero}</span>
          {titulo}
        </p>
        {descricao && <p className="mt-1.5 text-xs leading-5 text-slate-500 md:pl-8">{descricao}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Rotulo({ children, opcional }: { children: ReactNode; opcional?: boolean }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
      {opcional && <span className="ml-1 font-normal text-slate-400">(opcional)</span>}
    </span>
  );
}

function BotaoEnviar({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="primary-button">
      <PaperAirplaneIcon className="h-4 w-4" />
      {pending ? "Enviando…" : "Enviar memorando"}
    </button>
  );
}

export default function NovoMemorandoForm({
  meuId,
  setores,
  usuarios,
  modelos,
}: {
  meuId: string;
  setores: Setor[];
  usuarios: Usuario[];
  modelos: Modelo[];
}) {
  const [setorIds, setSetorIds] = useState<string[]>([]);
  const [modeloId, setModeloId] = useState<string>("");
  // Sucesso redireciona para o memorando criado; erro de validação volta como valor.
  const { onSubmit, pendente, erro } = useEnvio(criarMemorandoSeguro, () => {});

  const usuariosFiltrados = useMemo(
    () => usuarios.filter((u) => u.setorId && setorIds.includes(u.setorId)),
    [usuarios, setorIds]
  );

  const modelo = modelos.find((m) => m.id === modeloId);
  const pessoas = usuarios.map((u) => ({ id: u.id, nome: u.nome, detalhe: u.setorNome }));

  function toggleSetor(id: string) {
    setSetorIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  return (
    <form onSubmit={onSubmit} className="surface-panel">
      <Secao numero={1} titulo="Destino" descricao="Quem deve executar esta solicitação.">
        <div>
          <Rotulo>Setor(es) destinatário(s)</Rotulo>
          <div className="flex flex-wrap gap-2">
            {setores.map((s) => {
              const ativo = setorIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan-500 has-[:focus-visible]:ring-offset-1 ${
                    ativo ? "border-cyan-700 bg-cyan-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <input type="checkbox" name="setorIds" value={s.id} checked={ativo} onChange={() => toggleSetor(s.id)} className="sr-only" />
                  {ativo && <CheckIcon className="h-3.5 w-3.5" />}
                  {s.nome}
                </label>
              );
            })}
          </div>
        </div>

        <label className="block">
          <Rotulo opcional>A/C — pessoa responsável</Rotulo>
          <select name="acUserId" className="form-control" defaultValue="" disabled={setorIds.length === 0}>
            <option value="">{setorIds.length === 0 ? "Selecione um setor primeiro" : "Sem destinatário específico"}</option>
            {usuariosFiltrados.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </label>
      </Secao>

      <Secao numero={2} titulo="Conteúdo" descricao="Use um modelo para padronizar pedidos recorrentes.">
        <label className="block">
          <Rotulo>Assunto</Rotulo>
          <input name="assunto" maxLength={120} required className="form-control" placeholder="Ex.: Reserva de sala para oficina técnica" />
        </label>

        <label className="block">
          <Rotulo opcional>Modelo</Rotulo>
          <select name="modeloId" value={modeloId} onChange={(e) => setModeloId(e.target.value)} className="form-control">
            <option value="">Texto livre</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </label>

        {modelo && (
          <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2">
            {modelo.campos.map((campo) => (
              <label key={campo.chave} className={`block ${campo.tipo === "textarea" ? "sm:col-span-2" : ""}`}>
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {campo.label}
                  {campo.obrigatorio && <span className="text-red-500"> *</span>}
                </span>
                {campo.tipo === "textarea" ? (
                  <textarea name={`modelo_${campo.chave}`} required={campo.obrigatorio} rows={2} className="form-control" />
                ) : (
                  <input name={`modelo_${campo.chave}`} type={campo.tipo === "date" ? "date" : "text"} required={campo.obrigatorio} className="form-control" />
                )}
              </label>
            ))}
          </div>
        )}

        <label className="block">
          <Rotulo opcional={!!modelo}>{modelo ? "Observações" : "Mensagem"}</Rotulo>
          <textarea
            name="corpo"
            required={!modelo}
            rows={6}
            className="form-control"
            placeholder={modelo ? "Informações adicionais" : "Descreva a solicitação com o máximo de contexto possível."}
          />
        </label>
      </Secao>

      <Secao numero={3} titulo="Pessoas" descricao="Ciência apenas notifica. Assinatura bloqueia a conclusão até todos assinarem.">
        <div>
          <Rotulo opcional>Marcar para ciência</Rotulo>
          <PessoasChips name="cienciaIds" pessoas={pessoas} excluir={meuId} />
        </div>
        <div>
          <Rotulo opcional>Solicitar assinatura de</Rotulo>
          <PessoasChips name="signatarioIds" pessoas={pessoas} />
        </div>
      </Secao>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {erro ? (
          <p className="flex items-center gap-1.5 text-sm text-red-600" role="alert"><ExclamationCircleIcon className="h-4 w-4 shrink-0" />{erro}</p>
        ) : (
          <p className="text-xs text-slate-400">O código do memorando é gerado automaticamente.</p>
        )}
        <div className="flex gap-2 sm:justify-end">
          <Link href="/memorandos" className="secondary-button">Cancelar</Link>
          <BotaoEnviar pending={pendente} />
        </div>
      </div>
    </form>
  );
}
