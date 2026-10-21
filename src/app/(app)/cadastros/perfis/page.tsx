import type { Metadata } from "next";
import Link from "next/link";
import { EyeSlashIcon, LockClosedIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { PERMISSOES, lerPermissoes, perfilEfetivoId, permissoesDoTipo, type TipoPerfil } from "@/lib/permissoes";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { FormSeguro } from "@/components/form-seguro";
import { atualizarPerfilSeguro, criarPerfilSeguro, excluirPerfilSeguro } from "@/lib/actions/formularios";

export const metadata: Metadata = { title: "Perfis de acesso" };

const ROTULO_TIPO: Record<string, string> = { INTERNO: "Equipe do CTP", EXTERNO: "Prefeitura" };

/** Perfis de acesso (cargos): o que cada um vê e faz. */
export default async function PerfisPage({ searchParams }: { searchParams: Promise<{ perfil?: string; novo?: string }> }) {
  await exigirPermissao("cadastros");
  const { perfil: perfilParam, novo } = await searchParams;
  const [perfis, usuarios] = await Promise.all([
    prisma.perfil.findMany({ orderBy: [{ tipo: "desc" }, { nome: "asc" }] }),
    prisma.user.findMany({ where: { ativo: true }, select: { nome: true, tipo: true, perfilId: true, perfilInterno: true }, orderBy: { nome: "asc" } }),
  ]);
  // Contagem pelo perfil que vale no login — quem não tem perfil gravado está no de fábrica do tipo.
  const pessoasDo = (perfilId: string) => usuarios.filter((u) => perfilEfetivoId(u, perfis) === perfilId);
  const sel = novo ? undefined : perfis.find((p) => p.id === perfilParam) ?? perfis[0];
  const pessoasSel = sel ? pessoasDo(sel.id) : [];
  const marcadas = sel ? lerPermissoes(sel.permissoes, sel.tipo) : [];
  const disponiveis = sel ? permissoesDoTipo(sel.tipo as TipoPerfil) : [];
  const grupos = [...new Set(disponiveis.map((p) => PERMISSOES[p].grupo))];

  return (
    <>
      <PageHeader
        title="Perfis de acesso"
        description="Cada pessoa tem um perfil, que define o que ela pode fazer no sistema. Mudanças valem no próximo clique de cada pessoa."
        actions={<Link href="/cadastros/perfis?novo=1" className="primary-button"><PlusIcon className="h-4 w-4" />Novo perfil</Link>}
      />

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex flex-col gap-5 self-start">
          {(["INTERNO", "EXTERNO"] as const).map((tipo) => (
            <nav key={tipo} aria-label={`Perfis — ${ROTULO_TIPO[tipo]}`} className="surface-panel p-2">
              <p className="px-3 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{ROTULO_TIPO[tipo]}</p>
              {perfis.filter((p) => p.tipo === tipo).map((p) => {
                const n = pessoasDo(p.id).length;
                return (
                  <Link
                    key={p.id}
                    href={`/cadastros/perfis?perfil=${p.id}`}
                    aria-current={sel?.id === p.id ? "page" : undefined}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      sel?.id === p.id ? "bg-cyan-50 font-semibold text-cyan-900 ring-1 ring-inset ring-cyan-200" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{p.nome}</span>
                      {p.sistema && <LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="perfil de fábrica" />}
                    </span>
                    <span className="shrink-0 text-[11px] font-normal text-slate-400">{n} pessoa{n === 1 ? "" : "s"}</span>
                  </Link>
                );
              })}
            </nav>
          ))}
        </div>

        {novo ? (
          <Panel title="Novo perfil" description="Dê um nome de cargo e, se quiser, comece com as permissões de um perfil parecido.">
            <FormSeguro acao={criarPerfilSeguro} className="flex max-w-xl flex-col gap-4 p-5">
              <label className="text-xs font-semibold text-slate-600">
                Nome
                <input name="nome" required maxLength={60} placeholder="Ex.: Jurídico, Prefeito, Secretário" className="form-control mt-1 py-2 text-sm" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Para quem
                <select name="tipo" defaultValue="INTERNO" className="form-control mt-1 py-2 text-sm">
                  <option value="INTERNO">Equipe do CTP</option>
                  <option value="EXTERNO">Prefeitura</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Começar com as permissões de
                <select name="baseId" defaultValue="" className="form-control mt-1 py-2 text-sm">
                  <option value="">Nenhuma (marcar depois)</option>
                  {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome} ({ROTULO_TIPO[p.tipo]})</option>)}
                </select>
              </label>
              <div className="flex gap-2">
                <button className="primary-button"><PlusIcon className="h-4 w-4" />Criar perfil</button>
                <Link href="/cadastros/perfis" className="secondary-button">Cancelar</Link>
              </div>
            </FormSeguro>
          </Panel>
        ) : sel ? (
          <Panel
            title={`Perfil — ${sel.nome}`}
            description={`${ROTULO_TIPO[sel.tipo]} · ${pessoasSel.length ? `${pessoasSel.length} pessoa(s): ${pessoasSel.slice(0, 6).map((u) => u.nome).join(", ")}${pessoasSel.length > 6 ? "…" : ""}` : "ninguém com este perfil"}`}
            action={sel.sistema ? <Badge tone="slate">De fábrica</Badge> : undefined}
          >
            <FormSeguro key={sel.id} acao={atualizarPerfilSeguro} limparAoEnviar={false} className="flex flex-col gap-5 p-5" erroClassName="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <input type="hidden" name="perfilId" value={sel.id} />
              <div className="grid gap-3 sm:grid-cols-[240px_minmax(0,1fr)]">
                <label className="text-xs font-semibold text-slate-600">
                  Nome
                  <input name="nome" required maxLength={60} defaultValue={sel.nome} className="form-control mt-1 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Descrição
                  <input name="descricao" maxLength={200} defaultValue={sel.descricao ?? ""} placeholder="Para quem é este perfil" className="form-control mt-1 py-2 text-sm" />
                </label>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">O que este perfil pode fazer</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {sel.tipo === "EXTERNO"
                    ? "Todo usuário da prefeitura vê os projetos, contratos e conversas da sua prefeitura. Marque o que ele pode fazer além disso."
                    : "Todo colaborador vê memorandos, conversas e o chat das etapas. Marque o que ele pode fazer além disso. Etapas reservadas a alguns perfis são definidas em Tipos de contrato e Tipos de projeto."}
                </p>
                <div className="mt-3 flex flex-col gap-4">
                  {grupos.map((g) => (
                    <fieldset key={g}>
                      <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{g}</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {disponiveis.filter((p) => PERMISSOES[p].grupo === g).map((p) => (
                          <label key={p} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 has-[:checked]:border-cyan-300 has-[:checked]:bg-cyan-50/50">
                            <input type="checkbox" name="permissao" value={p} defaultChecked={marcadas.includes(p)} className="mt-0.5 h-4 w-4 accent-cyan-700" />
                            <span>
                              <span className="block text-sm font-medium text-slate-800">{PERMISSOES[p].rotulo}</span>
                              <span className="block text-xs leading-5 text-slate-500">{PERMISSOES[p].descricao}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </div>

              {sel.tipo === "INTERNO" && (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
                  <input type="checkbox" name="somenteParticipa" defaultChecked={sel.somenteParticipa} className="mt-0.5 h-4 w-4 accent-amber-600" />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><EyeSlashIcon className="h-4 w-4 text-amber-700" />Vê só os contratos e projetos em que participa</span>
                    <span className="block text-xs leading-5 text-slate-600">Onde é responsável, responsável por alguma etapa, signatário ou foi adicionado ao projeto. Os demais somem das listas, dos prazos e dos arquivos.</span>
                  </span>
                </label>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <button className="primary-button">Salvar perfil</button>
                <span className="text-xs text-slate-400">O sistema não deixa ficar sem ninguém com acesso a Cadastros.</span>
              </div>
            </FormSeguro>
            {!sel.sistema && (
              <FormSeguro acao={excluirPerfilSeguro} className="border-t border-slate-100 px-5 py-3">
                <input type="hidden" name="perfilId" value={sel.id} />
                <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50" disabled={pessoasSel.length > 0} title={pessoasSel.length > 0 ? "Mude o perfil das pessoas antes de excluir." : undefined}>
                  <TrashIcon className="h-3.5 w-3.5" />Excluir perfil{pessoasSel.length > 0 ? ` (em uso por ${pessoasSel.length})` : ""}
                </button>
              </FormSeguro>
            )}
          </Panel>
        ) : null}
      </div>
    </>
  );
}
