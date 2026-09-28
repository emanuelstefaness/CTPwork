"use client";

import { useState } from "react";
import Link from "next/link";
import { BuildingLibraryIcon, EnvelopeIcon, PlusIcon, RectangleStackIcon, TrashIcon } from "@heroicons/react/24/outline";
import { FormSeguro } from "@/components/form-seguro";
import { criarPrefeituraSeguro } from "@/lib/actions/formularios";

type Opcao = { id: string; nome: string };

function Secao({ numero, titulo, descricao, icone: Icone, children }: { numero: number; titulo: string; descricao: string; icone: typeof PlusIcon; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-slate-100 px-6 py-6 last:border-b-0 md:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-cyan-50 text-[11px] font-bold text-cyan-700">{numero}</span>
          {titulo}
        </p>
        <p className="mt-1.5 flex gap-1.5 text-xs leading-5 text-slate-500 md:pl-8"><Icone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{descricao}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export default function NovaPrefeituraForm({
  perfisPrefeitura,
  fluxosContrato,
  tiposProjeto,
  perfilPadrao,
}: {
  perfisPrefeitura: Opcao[];
  fluxosContrato: Opcao[];
  tiposProjeto: Opcao[];
  perfilPadrao: string;
}) {
  const [linhas, setLinhas] = useState([0]);
  const [proxima, setProxima] = useState(1);

  return (
    <FormSeguro acao={criarPrefeituraSeguro} limparAoEnviar={false} className="surface-panel" erroClassName="flex items-center gap-1.5 border-t border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
      <Secao numero={1} titulo="Prefeitura" descricao="Dados do município contratante." icone={BuildingLibraryIcon}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Nome</span>
          <input name="nome" required maxLength={120} placeholder="Ex.: Prefeitura de Clevelândia" className="form-control" />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Contato <span className="font-normal text-slate-400">(opcional)</span></span>
            <input name="contatoNome" className="form-control" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">E-mail do contato</span>
            <input name="contatoEmail" type="email" className="form-control" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Telefone</span>
            <input name="contatoFone" className="form-control" />
          </label>
        </div>
      </Secao>

      <Secao numero={2} titulo="Acessos da prefeitura" descricao="Cada pessoa recebe um convite por e-mail para criar a própria senha. Ela só verá o que é desta prefeitura." icone={EnvelopeIcon}>
        {linhas.map((id, i) => (
          <div key={id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px_auto] sm:items-end">
            <label className="text-xs font-semibold text-slate-600">
              Nome
              <input name="usuarioNome" className="form-control mt-1 py-2 text-sm" placeholder="Ex.: Maria Souza" aria-label={`Nome do usuário ${i + 1}`} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              E-mail
              <input name="usuarioEmail" type="email" className="form-control mt-1 py-2 text-sm" placeholder="maria@prefeitura.gov.br" aria-label={`E-mail do usuário ${i + 1}`} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Perfil
              <select name="usuarioPerfil" defaultValue={perfilPadrao} className="form-control mt-1 py-2 text-sm" aria-label={`Perfil do usuário ${i + 1}`}>
                {perfisPrefeitura.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <button
              type="button"
              aria-label={`Remover usuário ${i + 1}`}
              onClick={() => setLinhas((l) => l.filter((x) => x !== id))}
              disabled={linhas.length === 1}
              className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => { setLinhas((l) => [...l, proxima]); setProxima((n) => n + 1); }} className="secondary-button self-start text-xs">
          <PlusIcon className="h-4 w-4" />Adicionar pessoa
        </button>
        <p className="text-xs text-slate-400">Deixe as linhas em branco para cadastrar os acessos depois, em Cadastros › Usuários.</p>
      </Secao>

      <Secao numero={3} titulo="Fluxos exclusivos" descricao="Opcional: cria cópias só desta prefeitura, que você ajusta depois em Cadastros. Os fluxos gerais continuam disponíveis para ela." icone={RectangleStackIcon}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Tipo de contrato exclusivo</span>
            <select name="fluxoContratoBase" defaultValue="" className="form-control">
              <option value="">Não criar</option>
              {fluxosContrato.map((f) => <option key={f.id} value={f.id}>Copiar de “{f.nome}”</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Tipo de projeto exclusivo</span>
            <select name="fluxoProjetoBase" defaultValue="" className="form-control">
              <option value="">Não criar</option>
              {tiposProjeto.map((t) => <option key={t.id} value={t.id}>Copiar de “{t.nome}”</option>)}
            </select>
          </label>
        </div>
      </Secao>

      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
        <Link href="/cadastros?aba=municipios" className="secondary-button">Cancelar</Link>
        <button type="submit" className="primary-button"><BuildingLibraryIcon className="h-4 w-4" />Cadastrar prefeitura e enviar convites</button>
      </div>
    </FormSeguro>
  );
}
