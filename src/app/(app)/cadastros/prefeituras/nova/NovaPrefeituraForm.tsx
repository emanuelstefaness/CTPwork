"use client";

import { useState } from "react";
import Link from "next/link";
import { BuildingLibraryIcon, KeyIcon, PlusIcon, RectangleStackIcon, TrashIcon } from "@heroicons/react/24/outline";
import { CampoSenha } from "@/components/campo-senha";
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

      <Secao numero={2} titulo="Acessos da prefeitura" descricao="Defina o e-mail e a senha inicial de cada pessoa e repasse para ela. Cada uma só vê o que é desta prefeitura e cria a própria senha no primeiro acesso." icone={KeyIcon}>
        {linhas.map((id, i) => (
          <div key={id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pessoa {i + 1}</p>
              <button
                type="button"
                aria-label={`Remover usuário ${i + 1}`}
                onClick={() => setLinhas((l) => l.filter((x) => x !== id))}
                disabled={linhas.length === 1}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:invisible"
              >
                <TrashIcon className="h-3.5 w-3.5" />Remover
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">
                Nome
                <input name="usuarioNome" maxLength={120} className="form-control mt-1 py-2 text-sm" placeholder="Ex.: Maria Souza" aria-label={`Nome do usuário ${i + 1}`} />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                E-mail (login)
                <input name="usuarioEmail" type="email" maxLength={254} className="form-control mt-1 py-2 text-sm" placeholder="maria@prefeitura.gov.br" aria-label={`E-mail do usuário ${i + 1}`} />
              </label>
              <CampoSenha name="usuarioSenha" label="Senha inicial" obrigatoria={false} rotuloAcessivel={`Senha do usuário ${i + 1}`} />
              <label className="text-xs font-semibold text-slate-600">
                Perfil de acesso
                <select name="usuarioPerfil" defaultValue={perfilPadrao} className="form-control mt-1 py-2 text-sm" aria-label={`Perfil do usuário ${i + 1}`}>
                  {perfisPrefeitura.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </label>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => { setLinhas((l) => [...l, proxima]); setProxima((n) => n + 1); }} className="secondary-button self-start text-xs">
          <PlusIcon className="h-4 w-4" />Adicionar pessoa
        </button>
        <p className="text-xs text-slate-400">Pode deixar em branco e cadastrar os acessos depois, na página da prefeitura.</p>
      </Secao>

      <Secao numero={3} titulo="Tipos exclusivos" descricao="Opcional: cria cópias só desta prefeitura, que você ajusta depois em Tipos de contrato e Tipos de projeto. Os tipos gerais continuam disponíveis para ela." icone={RectangleStackIcon}>
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
        <Link href="/cadastros/prefeituras" className="secondary-button">Cancelar</Link>
        <button type="submit" className="primary-button"><BuildingLibraryIcon className="h-4 w-4" />Cadastrar prefeitura</button>
      </div>
    </FormSeguro>
  );
}
