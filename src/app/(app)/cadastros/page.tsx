import {
  atualizarEtapaModeloSeguro, atualizarModeloFormularioSeguro, atualizarMunicipioSeguro, atualizarUsuarioSeguro,
  criarEtapaModeloSeguro, criarModeloFormularioSeguro, criarMunicipioSeguro, criarSetorSeguro, criarTipoProjetoSeguro,
  criarUsuarioSeguro, renomearSetorSeguro, renomearTipoProjetoSeguro,
  alternarFluxoContratoSeguro, atualizarFluxoContratoSeguro, criarFluxoContratoSeguro, reenviarConviteSeguro,
} from "@/lib/actions/formularios";
import { EtapaFluxoContratoRow, NovaEtapaFluxoContrato } from "./EtapaFluxoContrato";
import { FormSeguro } from "@/components/form-seguro";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { removerEtapaModelo, moverEtapaModelo } from "@/lib/actions/cadastros";
import { PageHeader, Panel, Badge } from "@/components/ui";
import UsuarioForm from "./UsuarioForm";
import { AbaPerfis } from "./AbaPerfis";
import { BotaoAcessoUsuario } from "./BotaoAcessoUsuario";
import { formatarDiaDoEvento } from "@/lib/formatters";
import ModeloFormularioForm from "./ModeloFormularioForm";
import EtapaModeloRow from "./EtapaModeloRow";
import NovaEtapaModeloForm from "./NovaEtapaModeloForm";
import { BuildingLibraryIcon, ClipboardDocumentListIcon, DocumentTextIcon, PlusIcon, RectangleGroupIcon, RectangleStackIcon, ShieldCheckIcon, UsersIcon } from "@heroicons/react/24/outline";

const ABAS = [
  { chave: "setores", label: "Setores", icon: RectangleGroupIcon },
  { chave: "usuarios", label: "Usuários", icon: UsersIcon },
  { chave: "perfis", label: "Perfis e permissões", icon: ShieldCheckIcon },
  { chave: "municipios", label: "Municípios", icon: BuildingLibraryIcon },
  { chave: "modelos", label: "Modelos de formulário", icon: DocumentTextIcon },
  { chave: "fluxos", label: "Fluxos de projeto", icon: RectangleStackIcon },
  { chave: "fluxos-contrato", label: "Fluxos de contrato", icon: ClipboardDocumentListIcon },
] as const;

export const metadata: Metadata = { title: "Cadastros" };

const nomeCurto = (municipio: string) => municipio.replace(/^Prefeitura (Municipal )?de /, "");

export default async function CadastrosPage({ searchParams }: { searchParams: Promise<{ aba?: string; editar?: string; fluxo?: string; perfil?: string; nova?: string }> }) {
  const gestor = await exigirPermissao("cadastros");
  const { aba: abaParam, editar, fluxo: fluxoParam, perfil: perfilParam, nova } = await searchParams;
  const aba = ABAS.some((a) => a.chave === abaParam) ? abaParam! : "setores";

  const [setores, municipios, usuarios, modelos, tiposProjeto, fluxosContrato, perfis] = await Promise.all([
    prisma.setor.findMany({ orderBy: { nome: "asc" } }),
    prisma.municipio.findMany({ orderBy: { nome: "asc" } }),
    prisma.user.findMany({ include: { setor: true, municipio: true, perfil: { select: { nome: true } } }, orderBy: { nome: "asc" } }),
    prisma.modeloFormulario.findMany({ orderBy: { nome: "asc" } }),
    prisma.tipoProjetoModelo.findMany({ include: { etapas: { orderBy: { ordem: "asc" } }, municipio: { select: { nome: true } } }, orderBy: { nome: "asc" } }),
    prisma.fluxoContrato.findMany({ include: { etapas: { orderBy: { ordem: "asc" } }, municipio: { select: { nome: true } }, _count: { select: { contratos: true } } }, orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    prisma.perfil.findMany({ include: { _count: { select: { usuarios: true } } }, orderBy: [{ tipo: "desc" }, { nome: "asc" }] }),
  ]);
  // Resumo do que o assistente "Nova prefeitura" acabou de criar.
  const prefeituraNova = nova
    ? await prisma.municipio.findUnique({
        where: { id: nova },
        include: { usuariosExternos: { select: { nome: true, email: true } }, fluxosContrato: { select: { nome: true } }, tiposProjeto: { select: { nome: true } } },
      })
    : null;
  const perfilSel = perfis.find((p) => p.id === perfilParam) ?? perfis[0];
  const perfisOpcoes = perfis.map((p) => ({ id: p.id, nome: p.nome, tipo: p.tipo }));
  const perfisInternos = perfisOpcoes.filter((p) => p.tipo === "INTERNO");
  const fluxoSelecionado = tiposProjeto.find((t) => t.id === fluxoParam) ?? tiposProjeto[0];
  const fluxoContratoSel = fluxosContrato.find((f) => f.id === fluxoParam) ?? fluxosContrato[0];

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow="Administração" title="Cadastros" description="Usuários, perfis e permissões, municípios, setores, modelos de formulário e fluxos de projeto e de contrato." />

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

      {aba === "municipios" && prefeituraNova && (
        <div role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <p className="font-semibold">{prefeituraNova.nome} cadastrada.</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-emerald-800">
            {prefeituraNova.usuariosExternos.map((u) => <li key={u.email}>Convite enviado para {u.nome} ({u.email})</li>)}
            {prefeituraNova.usuariosExternos.length === 0 && <li>Nenhum acesso criado ainda — cadastre em Usuários quando quiser.</li>}
            {prefeituraNova.fluxosContrato.map((f) => <li key={f.nome}>Tipo de contrato exclusivo: {f.nome}</li>)}
            {prefeituraNova.tiposProjeto.map((t) => <li key={t.nome}>Tipo de projeto exclusivo: {t.nome}</li>)}
          </ul>
        </div>
      )}

      {aba === "municipios" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Panel
            title="Municípios cadastrados"
            description={`${municipios.length} município(s)`}
            action={<Link href="/cadastros/nova-prefeitura" className="primary-button min-h-9 px-3 py-1.5 text-xs"><PlusIcon className="h-4 w-4" />Nova prefeitura (assistente)</Link>}
          >
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
                      perfis={perfisOpcoes}
                      usuario={{ id: u.id, nome: u.nome, email: u.email, tipo: u.tipo, perfilId: u.perfilId, setorId: u.setorId, municipioId: u.municipioId }}
                      action={atualizarUsuarioSeguro}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className={`min-w-0 ${u.ativo ? "" : "opacity-60"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-800">{u.nome}</p>
                          <Badge tone={u.tipo === "INTERNO" ? "cyan" : "emerald"}>{u.perfil?.nome ?? (u.tipo === "INTERNO" ? "Colaborador" : "Município")}{u.tipo === "INTERNO" ? " · CTP" : ""}</Badge>
                          {!u.ativo && <Badge tone="slate">Desativado{u.desativadoEm ? ` em ${formatarDiaDoEvento(u.desativadoEm)}` : ""}</Badge>}
                          {u.ativo && u.convitePendente && <Badge tone="amber">Convite pendente</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{u.email} · {u.tipo === "INTERNO" ? (u.setor?.nome ?? "sem setor") : (u.municipio?.nome ?? "sem município")}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {u.ativo && u.convitePendente && (
                          <FormSeguro acao={reenviarConviteSeguro} className="flex flex-col items-end" erroClassName="text-[11px] text-red-600">
                            <input type="hidden" name="usuarioId" value={u.id} />
                            <button className="min-h-8 rounded-lg px-3 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50">Reenviar convite</button>
                          </FormSeguro>
                        )}
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
              <UsuarioForm modo="criar" setores={setores} municipios={municipios} perfis={perfisOpcoes} action={criarUsuarioSeguro} />
            </div>
          </Panel>
        </div>
      )}

      {aba === "perfis" && <AbaPerfis perfis={perfis} selecionado={perfilSel} />}

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
                  {t.municipio && <span className="rounded bg-violet-50 px-1 text-[10px] font-semibold text-violet-700">{nomeCurto(t.municipio.nome)}</span>}
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
                <FormSeguro key={fluxoSelecionado.id} acao={renomearTipoProjetoSeguro} limparAoEnviar={false}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="tipoId" value={fluxoSelecionado.id} />
                    <input name="nome" aria-label="Nome do tipo de projeto" defaultValue={fluxoSelecionado.nome} className="form-control w-48 py-1.5 text-xs" />
                    <select name="municipioId" aria-label="Disponível para" defaultValue={fluxoSelecionado.municipioId ?? ""} className="form-control w-auto py-1.5 text-xs">
                      <option value="">Todas as prefeituras</option>
                      {municipios.map((m) => <option key={m.id} value={m.id}>Só {m.nome}</option>)}
                    </select>
                    <button className="secondary-button min-h-8 px-2.5 py-1 text-[11px]">Salvar</button>
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

      {aba === "fluxos-contrato" && (
        <div className="flex flex-col gap-5">
          <Panel title="Tipos de contrato" description="Cada tipo tem as próprias etapas — ex.: Padrão, Dispensa de licitação, Termo aditivo. Mudanças valem para contratos criados depois.">
            <div className="flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                {fluxosContrato.map((f) => (
                  <Link
                    key={f.id}
                    href={`/cadastros?aba=fluxos-contrato&fluxo=${f.id}`}
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                      fluxoContratoSel?.id === f.id ? "border-cyan-400 bg-cyan-50 text-cyan-700" : "border-slate-200 text-slate-600 hover:border-cyan-200 hover:bg-cyan-50/50"
                    } ${f.ativo ? "" : "opacity-60"}`}
                  >
                    {f.nome}
                    {f.municipio && <span className="rounded bg-violet-50 px-1 text-[10px] font-semibold text-violet-700">{nomeCurto(f.municipio.nome)}</span>}
                    {!f.ativo && <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">inativo</span>}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${fluxoContratoSel?.id === f.id ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-500"}`}>{f.etapas.length}</span>
                  </Link>
                ))}
              </div>
              <FormSeguro acao={criarFluxoContratoSeguro} className="flex flex-col gap-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-600">Novo tipo de contrato</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input name="nome" required maxLength={80} placeholder="Ex.: Dispensa de licitação" className="form-control w-64 py-2 text-xs" />
                  <select name="baseId" defaultValue="" className="form-control w-auto py-2 text-xs" aria-label="Começar a partir de">
                    <option value="">Começar vazio</option>
                    {fluxosContrato.map((f) => <option key={f.id} value={f.id}>Copiar etapas de “{f.nome}”</option>)}
                  </select>
                  <button className="secondary-button min-h-9 px-3 py-1.5 text-xs"><PlusIcon className="h-3.5 w-3.5" />Criar</button>
                </div>
              </FormSeguro>
            </div>
          </Panel>

          {fluxoContratoSel && (
            <Panel
              title={`Etapas — ${fluxoContratoSel.nome}`}
              description={`${fluxoContratoSel.etapas.length} etapa(s) · ${fluxoContratoSel._count.contratos} contrato(s) usam este tipo`}
              action={
                <FormSeguro acao={alternarFluxoContratoSeguro} className="flex flex-col items-end" erroClassName="mt-1 max-w-[260px] text-right text-[11px] text-red-600">
                  <input type="hidden" name="fluxoId" value={fluxoContratoSel.id} />
                  <input type="hidden" name="ativo" value={String(!fluxoContratoSel.ativo)} />
                  <button className={`min-h-8 rounded-lg px-3 py-1 text-[11px] font-semibold ${fluxoContratoSel.ativo ? "text-red-600 hover:bg-red-50" : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>
                    {fluxoContratoSel.ativo ? "Desativar tipo" : "Ativar tipo"}
                  </button>
                </FormSeguro>
              }
            >
              <div className="flex flex-col gap-3 p-5">
                <FormSeguro key={fluxoContratoSel.id} acao={atualizarFluxoContratoSeguro} limparAoEnviar={false} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[200px_minmax(0,1fr)_200px_auto] sm:items-end">
                  <input type="hidden" name="fluxoId" value={fluxoContratoSel.id} />
                  <label className="text-xs font-semibold text-slate-600">Nome<input name="nome" required defaultValue={fluxoContratoSel.nome} className="form-control mt-1 py-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-600">Descrição<input name="descricao" defaultValue={fluxoContratoSel.descricao ?? ""} placeholder="Quando usar este tipo" className="form-control mt-1 py-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-600">
                    Disponível para
                    <select name="municipioId" defaultValue={fluxoContratoSel.municipioId ?? ""} className="form-control mt-1 py-2 text-sm">
                      <option value="">Todas as prefeituras</option>
                      {municipios.map((m) => <option key={m.id} value={m.id}>Só {m.nome}</option>)}
                    </select>
                  </label>
                  <button className="secondary-button min-h-9 px-3 py-1.5 text-xs">Salvar</button>
                </FormSeguro>

                {fluxoContratoSel.etapas.length < 2 && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    Um tipo de contrato precisa de pelo menos 2 etapas para ser usado. A última etapa é o estado final do contrato.
                  </p>
                )}
                {fluxoContratoSel.etapas.length >= 2 && !fluxoContratoSel.etapas.some((e) => e.liberaProjeto) && (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                    Nenhuma etapa libera o projeto: contratos deste tipo não geram projeto técnico (útil para aditivos, por exemplo).
                  </p>
                )}
                {fluxoContratoSel.etapas.map((etapa, i) => (
                  <EtapaFluxoContratoRow key={etapa.id} etapa={etapa} posicao={i} total={fluxoContratoSel.etapas.length} perfis={perfisInternos} />
                ))}
                <NovaEtapaFluxoContrato fluxoId={fluxoContratoSel.id} perfis={perfisInternos} />
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
