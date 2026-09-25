import {
  atualizarEtapaModeloSeguro, atualizarModeloFormularioSeguro, atualizarMunicipioSeguro, atualizarUsuarioSeguro,
  criarEtapaModeloSeguro, criarModeloFormularioSeguro, criarMunicipioSeguro, criarSetorSeguro, criarTipoProjetoSeguro,
  criarUsuarioSeguro, renomearSetorSeguro, renomearTipoProjetoSeguro,
} from "@/lib/actions/formularios";
import { FormSeguro } from "@/components/form-seguro";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireGestor } from "@/lib/tenant";
import { removerEtapaModelo, moverEtapaModelo } from "@/lib/actions/cadastros";
import { PageHeader, Panel, Badge } from "@/components/ui";
import UsuarioForm from "./UsuarioForm";
import { BotaoAcessoUsuario } from "./BotaoAcessoUsuario";
import { formatarDiaDoEvento } from "@/lib/formatters";
import ModeloFormularioForm from "./ModeloFormularioForm";
import EtapaModeloRow from "./EtapaModeloRow";
import NovaEtapaModeloForm from "./NovaEtapaModeloForm";
import { BuildingLibraryIcon, DocumentTextIcon, PlusIcon, RectangleGroupIcon, RectangleStackIcon, UsersIcon } from "@heroicons/react/24/outline";

const ABAS = [
  { chave: "setores", label: "Setores", icon: RectangleGroupIcon },
  { chave: "usuarios", label: "Usuários", icon: UsersIcon },
  { chave: "municipios", label: "Municípios", icon: BuildingLibraryIcon },
  { chave: "modelos", label: "Modelos de formulário", icon: DocumentTextIcon },
  { chave: "fluxos", label: "Fluxos de projeto", icon: RectangleStackIcon },
] as const;

export const metadata: Metadata = { title: "Cadastros" };

export default async function CadastrosPage({ searchParams }: { searchParams: Promise<{ aba?: string; editar?: string; fluxo?: string }> }) {
  const gestor = await requireGestor();
  const { aba: abaParam, editar, fluxo: fluxoParam } = await searchParams;
  const aba = ABAS.some((a) => a.chave === abaParam) ? abaParam! : "setores";

  const [setores, municipios, usuarios, modelos, tiposProjeto] = await Promise.all([
    prisma.setor.findMany({ orderBy: { nome: "asc" } }),
    prisma.municipio.findMany({ orderBy: { nome: "asc" } }),
    prisma.user.findMany({ include: { setor: true, municipio: true }, orderBy: { nome: "asc" } }),
    prisma.modeloFormulario.findMany({ orderBy: { nome: "asc" } }),
    prisma.tipoProjetoModelo.findMany({ include: { etapas: { orderBy: { ordem: "asc" } } }, orderBy: { nome: "asc" } }),
  ]);
  const fluxoSelecionado = tiposProjeto.find((t) => t.id === fluxoParam) ?? tiposProjeto[0];

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow="Administração" title="Cadastros" description="Setores, usuários, municípios, modelos de formulário e fluxos de projeto — restrito a Gestor CTP." />

      <div className="surface-panel mb-5 flex flex-wrap gap-1 p-1.5">
        {ABAS.map((a) => (
          <Link
            key={a.chave}
            href={`/cadastros?aba=${a.chave}`}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              aba === a.chave ? "bg-cyan-500 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <a.icon className="h-4 w-4" />
            {a.label}
          </Link>
        ))}
      </div>

      {aba === "setores" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Panel title="Setores cadastrados" description={`${setores.length} setor(es)`}>
            <div className="divide-y divide-slate-100">
              {setores.map((s) => (
                <FormSeguro key={s.id} acao={renomearSetorSeguro} limparAoEnviar={false} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <input type="hidden" name="setorId" value={s.id} />
                    <input name="nome" defaultValue={s.nome} className="form-control flex-1 py-2 text-sm" />
                    <button className="secondary-button min-h-9 px-3 py-1.5 text-xs">Salvar</button>
                  </div>
                </FormSeguro>
              ))}
              {setores.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">Nenhum setor cadastrado.</p>}
            </div>
          </Panel>
          <Panel title="Novo setor">
            <FormSeguro acao={criarSetorSeguro} className="flex flex-col gap-3 p-5">
              <label className="text-xs font-semibold text-slate-600">
                Nome
                <input name="nome" required placeholder="Ex.: Financeiro" className="form-control mt-1" />
              </label>
              <button className="primary-button">
                <PlusIcon className="h-4 w-4" />
                Adicionar setor
              </button>
            </FormSeguro>
          </Panel>
        </div>
      )}

      {aba === "municipios" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Panel title="Municípios cadastrados" description={`${municipios.length} município(s)`}>
            <div className="divide-y divide-slate-100">
              {municipios.map((m) => (
                <div key={m.id} className="px-5 py-4">
                  {editar === m.id ? (
                    <FormSeguro acao={atualizarMunicipioSeguro} limparAoEnviar={false} className="grid gap-2 sm:grid-cols-2" erroClassName="flex items-center gap-1.5 text-xs text-red-600 sm:col-span-2">
                      <input type="hidden" name="municipioId" value={m.id} />
                      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                        Nome
                        <input name="nome" defaultValue={m.nome} required className="form-control mt-1 py-2 text-sm" />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Contato (nome)
                        <input name="contatoNome" defaultValue={m.contatoNome ?? ""} className="form-control mt-1 py-2 text-sm" />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Contato (e-mail)
                        <input name="contatoEmail" type="email" defaultValue={m.contatoEmail ?? ""} className="form-control mt-1 py-2 text-sm" />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Contato (telefone)
                        <input name="contatoFone" defaultValue={m.contatoFone ?? ""} className="form-control mt-1 py-2 text-sm" />
                      </label>
                      <div className="flex items-end gap-2">
                        <button className="primary-button min-h-9 py-1.5 text-xs">Salvar</button>
                        <Link href="/cadastros?aba=municipios" className="secondary-button min-h-9 px-3 py-1.5 text-xs">Cancelar</Link>
                      </div>
                    </FormSeguro>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{m.nome}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{m.contatoNome ?? "Sem contato definido"}{m.contatoEmail ? ` · ${m.contatoEmail}` : ""}{m.contatoFone ? ` · ${m.contatoFone}` : ""}</p>
                      </div>
                      <Link href={`/cadastros?aba=municipios&editar=${m.id}`} className="secondary-button min-h-8 px-3 py-1 text-[11px]">Editar</Link>
                    </div>
                  )}
                </div>
              ))}
              {municipios.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">Nenhum município cadastrado.</p>}
            </div>
          </Panel>
          <Panel title="Novo município">
            <FormSeguro acao={criarMunicipioSeguro} className="flex flex-col gap-3 p-5">
              <label className="text-xs font-semibold text-slate-600">
                Nome
                <input name="nome" required placeholder="Prefeitura de..." className="form-control mt-1" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Contato (nome)
                <input name="contatoNome" className="form-control mt-1" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Contato (e-mail)
                <input name="contatoEmail" type="email" className="form-control mt-1" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Contato (telefone)
                <input name="contatoFone" className="form-control mt-1" />
              </label>
              <button className="primary-button">
                <PlusIcon className="h-4 w-4" />
                Adicionar município
              </button>
            </FormSeguro>
          </Panel>
        </div>
      )}

      {aba === "usuarios" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Panel
            title="Usuários cadastrados"
            description={`${usuarios.filter((u) => u.ativo).length} ativo(s)${usuarios.some((u) => !u.ativo) ? ` · ${usuarios.filter((u) => !u.ativo).length} desativado(s)` : ""}`}
          >
            <div className="divide-y divide-slate-100">
              {/* Ativos primeiro; desativados no fim, esmaecidos. */}
              {[...usuarios].sort((a, b) => Number(b.ativo) - Number(a.ativo)).map((u) => (
                <div key={u.id} className={`px-5 py-3.5 ${u.ativo ? "" : "bg-slate-50/70"}`}>
                  {editar === u.id ? (
                    <UsuarioForm
                      modo="editar"
                      setores={setores}
                      municipios={municipios}
                      usuario={{ id: u.id, nome: u.nome, email: u.email, tipo: u.tipo, perfilInterno: u.perfilInterno, setorId: u.setorId, municipioId: u.municipioId }}
                      action={atualizarUsuarioSeguro}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className={`min-w-0 ${u.ativo ? "" : "opacity-60"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-800">{u.nome}</p>
                          <Badge tone={u.tipo === "INTERNO" ? "cyan" : "emerald"}>{u.tipo === "INTERNO" ? (u.perfilInterno === "GESTOR" ? "Gestor CTP" : "Colaborador CTP") : "Município"}</Badge>
                          {!u.ativo && <Badge tone="slate">Desativado{u.desativadoEm ? ` em ${formatarDiaDoEvento(u.desativadoEm)}` : ""}</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{u.email} · {u.tipo === "INTERNO" ? (u.setor?.nome ?? "sem setor") : (u.municipio?.nome ?? "sem município")}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {u.id !== gestor.id && <BotaoAcessoUsuario usuarioId={u.id} nome={u.nome} ativo={u.ativo} />}
                        {u.ativo && <Link href={`/cadastros?aba=usuarios&editar=${u.id}`} className="secondary-button min-h-8 px-3 py-1 text-[11px]">Editar</Link>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {usuarios.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">Nenhum usuário cadastrado.</p>}
            </div>
          </Panel>
          <Panel title="Novo usuário">
            <div className="p-5">
              <UsuarioForm modo="criar" setores={setores} municipios={municipios} action={criarUsuarioSeguro} />
            </div>
          </Panel>
        </div>
      )}

      {aba === "modelos" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Panel title="Modelos cadastrados" description={`${modelos.length} modelo(s)`}>
            <div className="divide-y divide-slate-100">
              {modelos.map((m) => {
                const campos = JSON.parse(m.campos) as { chave: string; label: string; tipo: string; obrigatorio: boolean }[];
                return (
                  <div key={m.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">{m.nome}</p>
                          <Badge tone={m.tipo === "MEMORANDO" ? "blue" : "violet"}>{m.tipo === "MEMORANDO" ? "Memorando" : "Contrato"}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">{campos.map((c) => c.label).join(", ")}</p>
                      </div>
                      <Link href={`/cadastros?aba=modelos&editar=${m.id}`} className="secondary-button min-h-8 shrink-0 px-3 py-1 text-[11px]">Editar</Link>
                    </div>
                  </div>
                );
              })}
              {modelos.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">Nenhum modelo cadastrado.</p>}
            </div>
          </Panel>
          <Panel title={editar ? "Editar modelo" : "Novo modelo"}>
            <div className="p-5">
              {(() => {
                const modeloEditando = editar ? modelos.find((m) => m.id === editar) : undefined;
                return (
                  <ModeloFormularioForm
                    modo={modeloEditando ? "editar" : "criar"}
                    action={modeloEditando ? atualizarModeloFormularioSeguro : criarModeloFormularioSeguro}
                    modelo={
                      modeloEditando
                        ? { id: modeloEditando.id, nome: modeloEditando.nome, tipo: modeloEditando.tipo, campos: JSON.parse(modeloEditando.campos) }
                        : undefined
                    }
                  />
                );
              })()}
            </div>
          </Panel>
        </div>
      )}

      {aba === "fluxos" && (
        <div className="flex flex-col gap-5">
          <Panel title="Tipos de projeto" description="Cada tipo tem seu próprio fluxo de etapas. Crie quantos precisar — ex.: Estatuto e PCCS, Plano Diretor, Plano de Mobilidade.">
            <div className="flex flex-wrap items-center gap-2 p-5">
              {tiposProjeto.map((t) => (
                <Link
                  key={t.id}
                  href={`/cadastros?aba=fluxos&fluxo=${t.id}`}
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                    fluxoSelecionado?.id === t.id
                      ? "border-cyan-400 bg-cyan-50 text-cyan-700"
                      : "border-slate-200 text-slate-600 hover:border-cyan-200 hover:bg-cyan-50/50"
                  }`}
                >
                  {t.nome}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${fluxoSelecionado?.id === t.id ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {t.etapas.length}
                  </span>
                </Link>
              ))}
              <FormSeguro acao={criarTipoProjetoSeguro}>
                <div className="flex items-center gap-2">
                  <input name="nome" required placeholder="Novo tipo de projeto..." className="form-control py-2 text-xs" />
                  <button className="secondary-button min-h-9 px-3 py-1.5 text-xs">
                    <PlusIcon className="h-3.5 w-3.5" />
                    Criar
                  </button>
                </div>
              </FormSeguro>
              {tiposProjeto.length === 0 && <p className="text-sm text-slate-400">Nenhum tipo de projeto cadastrado ainda.</p>}
            </div>
          </Panel>

          {fluxoSelecionado && (
            <Panel
              title={`Fluxo de etapas — ${fluxoSelecionado.nome}`}
              description={`${fluxoSelecionado.etapas.length} etapa(s) · identificador interno "${fluxoSelecionado.chave}" (não muda, mesmo se você renomear)`}
              action={
                <FormSeguro acao={renomearTipoProjetoSeguro} limparAoEnviar={false}>
                  <div className="flex items-center gap-2">
                    <input type="hidden" name="tipoId" value={fluxoSelecionado.id} />
                    <input name="nome" defaultValue={fluxoSelecionado.nome} className="form-control py-1.5 text-xs" />
                    <button className="secondary-button min-h-8 px-2.5 py-1 text-[11px]">Renomear</button>
                  </div>
                </FormSeguro>
              }
            >
              <div className="flex flex-col gap-3 p-5">
                {fluxoSelecionado.etapas.map((etapa, i) => (
                  <EtapaModeloRow
                    key={etapa.id}
                    etapa={etapa}
                    posicao={i}
                    total={fluxoSelecionado.etapas.length}
                    atualizar={atualizarEtapaModeloSeguro}
                    remover={removerEtapaModelo}
                    mover={moverEtapaModelo}
                  />
                ))}
                {fluxoSelecionado.etapas.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
                    Este fluxo ainda não tem etapas. Adicione a primeira abaixo.
                  </p>
                )}
                <NovaEtapaModeloForm tipoProjetoModeloId={fluxoSelecionado.id} action={criarEtapaModeloSeguro} />
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
