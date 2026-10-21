import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, RectangleGroupIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { perfilEfetivoId } from "@/lib/permissoes";
import { formatarDiaDoEvento } from "@/lib/formatters";
import { Avatar, Badge, FilterPills, PageHeader, Panel } from "@/components/ui";
import { FormSeguro } from "@/components/form-seguro";
import { atualizarUsuarioSeguro, criarSetorSeguro, criarUsuarioSeguro, renomearSetorSeguro } from "@/lib/actions/formularios";
import { PessoaForm } from "../_ui/PessoaForm";
import { BotaoAcessoUsuario } from "../_ui/BotaoAcessoUsuario";
import { CampoBusca } from "../_ui/CampoBusca";
import { combina, urlCom } from "../_ui/busca";

export const metadata: Metadata = { title: "Equipe do CTP" };

type Filtros = { q?: string; setor?: string; editar?: string; nova?: string; setores?: string };

export default async function EquipePage({ searchParams }: { searchParams: Promise<Filtros> }) {
  const gestor = await exigirPermissao("cadastros");
  const { q, setor, editar, nova, setores: verSetores } = await searchParams;
  const [pessoas, setores, perfis] = await Promise.all([
    prisma.user.findMany({ where: { tipo: "INTERNO" }, include: { setor: { select: { nome: true } } }, orderBy: { nome: "asc" } }),
    prisma.setor.findMany({ orderBy: { nome: "asc" }, include: { _count: { select: { usuarios: { where: { ativo: true } } } } } }),
    prisma.perfil.findMany({ where: { tipo: "INTERNO" }, orderBy: { nome: "asc" }, select: { id: true, nome: true, tipo: true } }),
  ]);
  const nomePerfil = (id: string) => perfis.find((p) => p.id === id)?.nome ?? "Colaborador";
  const filtroSetor = setor === "desativados" || setores.some((s) => s.id === setor) ? setor : undefined;
  // Desativados ficam no fim, esmaecidos (dá para reativar dali); o filtro "Desativados" mostra só eles.
  const lista = pessoas
    .filter((p) => (filtroSetor === "desativados" ? !p.ativo : !filtroSetor || p.setorId === filtroSetor))
    .filter((p) => combina(q, p.nome, p.email, p.setor?.nome, nomePerfil(perfilEfetivoId(p, perfis))))
    .sort((a, b) => Number(b.ativo) - Number(a.ativo));
  const desativados = pessoas.filter((p) => !p.ativo).length;
  const aqui = (extra: Partial<Filtros> = {}) => urlCom("/cadastros/equipe", { q, setor: filtroSetor, ...extra });

  return (
    <>
      <PageHeader
        title="Equipe do CTP"
        description="Quem trabalha no CTP e usa o sistema. O perfil de acesso define o que cada pessoa pode fazer; os acessos das prefeituras ficam em Prefeituras."
        actions={
          <>
            <Link href={aqui({ setores: verSetores ? undefined : "1" })} className="secondary-button"><RectangleGroupIcon className="h-4 w-4" />Setores</Link>
            <Link href={aqui({ nova: "1" })} className="primary-button"><PlusIcon className="h-4 w-4" />Nova pessoa</Link>
          </>
        }
      />

      {verSetores && (
        <Panel title="Setores" description="Usados para organizar a equipe e para endereçar memorandos." className="mb-5" action={<Link href={aqui()} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Fechar</Link>}>
          <div className="grid gap-x-6 gap-y-2 p-5 md:grid-cols-2">
            {setores.map((s) => (
              <FormSeguro key={s.id} acao={renomearSetorSeguro} limparAoEnviar={false} className="flex items-center gap-2">
                <input type="hidden" name="setorId" value={s.id} />
                <input name="nome" required maxLength={80} defaultValue={s.nome} aria-label={`Nome do setor ${s.nome}`} className="form-control flex-1 py-2 text-sm" />
                <span className="w-16 shrink-0 text-right text-[11px] text-slate-400">{s._count.usuarios} pessoa{s._count.usuarios === 1 ? "" : "s"}</span>
                <button className="secondary-button min-h-9 px-3 py-1.5 text-xs">Salvar</button>
              </FormSeguro>
            ))}
          </div>
          <FormSeguro acao={criarSetorSeguro} className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4">
            <input name="nome" required maxLength={80} placeholder="Novo setor (ex.: Financeiro)" aria-label="Nome do novo setor" className="form-control w-64 py-2 text-sm" />
            <button className="secondary-button min-h-9 px-3 py-1.5 text-xs"><PlusIcon className="h-3.5 w-3.5" />Adicionar setor</button>
          </FormSeguro>
        </Panel>
      )}

      {nova && (
        <Panel title="Nova pessoa na equipe" description="Ela recebe o e-mail e a senha inicial de você e cria a própria senha no primeiro acesso." className="mb-5">
          <div className="p-5">
            <PessoaForm tipo="INTERNO" perfis={perfis} setores={setores} acao={criarUsuarioSeguro} rotuloEnviar="Cadastrar pessoa" voltarPara={aqui()} />
          </div>
        </Panel>
      )}

      <Panel>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4">
          <CampoBusca valor={q} placeholder="Buscar nome, e-mail ou setor" rotulo="Buscar na equipe" />
          <FilterPills
            options={[
              { label: "Todos", href: urlCom("/cadastros/equipe", { q }), active: !filtroSetor, count: pessoas.filter((p) => p.ativo).length },
              ...setores.map((s) => ({ label: s.nome, href: urlCom("/cadastros/equipe", { q, setor: s.id }), active: filtroSetor === s.id, count: s._count.usuarios })),
              ...(desativados ? [{ label: "Desativados", href: urlCom("/cadastros/equipe", { q, setor: "desativados" }), active: filtroSetor === "desativados", count: desativados }] : []),
            ]}
          />
        </div>
        <ul className="divide-y divide-slate-100">
          {lista.map((p) => {
            const perfilId = perfilEfetivoId(p, perfis);
            return (
              <li key={p.id} data-pessoa={p.email} className={`px-5 py-3.5 ${p.ativo ? "" : "bg-slate-50/70"}`}>
                {editar === p.id && p.ativo ? (
                  <PessoaForm
                    tipo="INTERNO"
                    perfis={perfis}
                    setores={setores}
                    pessoa={{ id: p.id, nome: p.nome, email: p.email, perfilId, setorId: p.setorId }}
                    acao={atualizarUsuarioSeguro}
                    rotuloEnviar="Salvar alterações"
                    voltarPara={aqui()}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className={`flex min-w-[13rem] flex-1 items-center gap-3 ${p.ativo ? "" : "opacity-60"}`}>
                      <Avatar name={p.nome} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{p.nome}</p>
                        <p className="truncate text-xs text-slate-400">{p.email} · {p.setor?.nome ?? "sem setor"}</p>
                      </div>
                    </div>
                    <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      <Badge tone="cyan">{nomePerfil(perfilId)}</Badge>
                      {!p.ativo && <Badge tone="slate">Desativado{p.desativadoEm ? ` em ${formatarDiaDoEvento(p.desativadoEm)}` : ""}</Badge>}
                      {p.id !== gestor.id && <BotaoAcessoUsuario usuarioId={p.id} nome={p.nome} ativo={p.ativo} />}
                      {p.ativo && <Link href={aqui({ editar: p.id })} scroll={false} className="secondary-button min-h-8 px-3 py-1 text-[11px]">Editar</Link>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {lista.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-400">Ninguém encontrado{q ? ` para “${q}”` : ""}.</li>}
        </ul>
      </Panel>
    </>
  );
}
