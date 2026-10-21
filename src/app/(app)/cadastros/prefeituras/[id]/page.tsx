import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardDocumentListIcon, PencilIcon, PlusIcon, RectangleStackIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { perfilEfetivoId } from "@/lib/permissoes";
import { formatarDiaDoEvento } from "@/lib/formatters";
import { Avatar, BackLink, Badge, DetailList, PageHeader, Panel } from "@/components/ui";
import { FormSeguro } from "@/components/form-seguro";
import { atualizarMunicipioSeguro, atualizarUsuarioSeguro, criarUsuarioSeguro } from "@/lib/actions/formularios";
import { PessoaForm } from "../../_ui/PessoaForm";
import { BotaoAcessoUsuario } from "../../_ui/BotaoAcessoUsuario";
import { urlCom } from "../../_ui/busca";

export const metadata: Metadata = { title: "Prefeitura" };

type Busca = { criada?: string; editar?: string; novo?: string; dados?: string };

export default async function PrefeituraPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Busca> }) {
  await exigirPermissao("cadastros");
  const { id } = await params;
  const { criada, editar, novo, dados } = await searchParams;
  const [prefeitura, perfis] = await Promise.all([
    prisma.municipio.findUnique({
      where: { id },
      include: {
        usuariosExternos: { orderBy: [{ ativo: "desc" }, { nome: "asc" }] },
        fluxosContrato: { select: { id: true, nome: true, ativo: true } },
        tiposProjeto: { select: { id: true, nome: true } },
        _count: { select: { contratos: true, projetos: true } },
      },
    }),
    prisma.perfil.findMany({ where: { tipo: "EXTERNO" }, orderBy: { nome: "asc" }, select: { id: true, nome: true, tipo: true } }),
  ]);
  if (!prefeitura) notFound();
  const aqui = (extra: Partial<Busca> = {}) => urlCom(`/cadastros/prefeituras/${id}`, extra);
  const nomePerfil = (perfilId: string) => perfis.find((p) => p.id === perfilId)?.nome ?? "Município";
  const ativos = prefeitura.usuariosExternos.filter((u) => u.ativo).length;

  return (
    <>
      <BackLink href="/cadastros/prefeituras" label="Prefeituras" />
      {criada && (
        <div role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <p className="font-semibold">{prefeitura.nome} cadastrada.</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-emerald-800">
            {prefeitura.usuariosExternos.map((u) => <li key={u.email}>Acesso criado para {u.nome} — login: {u.email}</li>)}
            {prefeitura.usuariosExternos.length === 0 && <li>Nenhum acesso criado ainda — cadastre abaixo quando quiser.</li>}
            {prefeitura.fluxosContrato.map((f) => <li key={f.id}>Tipo de contrato exclusivo: {f.nome}</li>)}
            {prefeitura.tiposProjeto.map((t) => <li key={t.id}>Tipo de projeto exclusivo: {t.nome}</li>)}
          </ul>
        </div>
      )}
      <PageHeader
        eyebrow="Prefeitura"
        title={prefeitura.nome}
        description={`${prefeitura._count.contratos} contrato(s) · ${prefeitura._count.projetos} projeto(s) · ${ativos} pessoa(s) com acesso`}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title="Acessos da prefeitura"
          description="Pessoas da prefeitura que entram no sistema. Cada uma só vê o que é desta prefeitura."
          action={!novo ? <Link href={aqui({ novo: "1" })} scroll={false} className="primary-button min-h-9 shrink-0 whitespace-nowrap px-3 py-1.5 text-xs"><PlusIcon className="h-4 w-4" />Novo acesso</Link> : undefined}
        >
          {novo && (
            <div className="border-b border-slate-100 bg-slate-50/60 p-5">
              <p className="mb-3 text-sm font-semibold text-slate-900">Novo acesso</p>
              <PessoaForm tipo="EXTERNO" perfis={perfis} municipioId={id} acao={criarUsuarioSeguro} rotuloEnviar="Criar acesso" voltarPara={aqui()} />
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {prefeitura.usuariosExternos.map((u) => {
              const perfilId = perfilEfetivoId(u, perfis);
              return (
                <li key={u.id} data-pessoa={u.email} className={`px-5 py-3.5 ${u.ativo ? "" : "bg-slate-50/70"}`}>
                  {editar === u.id && u.ativo ? (
                    <PessoaForm
                      tipo="EXTERNO"
                      perfis={perfis}
                      municipioId={id}
                      pessoa={{ id: u.id, nome: u.nome, email: u.email, perfilId, setorId: null }}
                      acao={atualizarUsuarioSeguro}
                      rotuloEnviar="Salvar alterações"
                      voltarPara={aqui()}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <div className={`flex min-w-[13rem] flex-1 items-center gap-3 ${u.ativo ? "" : "opacity-60"}`}>
                        <Avatar name={u.nome} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{u.nome}</p>
                          <p className="truncate text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <Badge tone="emerald">{nomePerfil(perfilId)}</Badge>
                        {!u.ativo && <Badge tone="slate">Desativado{u.desativadoEm ? ` em ${formatarDiaDoEvento(u.desativadoEm)}` : ""}</Badge>}
                        <BotaoAcessoUsuario usuarioId={u.id} nome={u.nome} ativo={u.ativo} />
                        {u.ativo && <Link href={aqui({ editar: u.id })} scroll={false} className="secondary-button min-h-8 px-3 py-1 text-[11px]">Editar</Link>}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {prefeitura.usuariosExternos.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-400">Ninguém da prefeitura tem acesso ainda.</li>}
          </ul>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel
            title="Dados da prefeitura"
            action={!dados ? <Link href={aqui({ dados: "editar" })} scroll={false} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline"><PencilIcon className="h-3.5 w-3.5" />Editar</Link> : undefined}
          >
            {dados ? (
              <FormSeguro acao={atualizarMunicipioSeguro} limparAoEnviar={false} className="flex flex-col gap-3 p-5">
                <input type="hidden" name="municipioId" value={id} />
                <label className="text-xs font-semibold text-slate-600">Nome<input name="nome" required maxLength={120} defaultValue={prefeitura.nome} className="form-control mt-1 py-2 text-sm" /></label>
                <label className="text-xs font-semibold text-slate-600">Contato<input name="contatoNome" maxLength={120} defaultValue={prefeitura.contatoNome ?? ""} className="form-control mt-1 py-2 text-sm" /></label>
                <label className="text-xs font-semibold text-slate-600">E-mail do contato<input name="contatoEmail" type="email" maxLength={254} defaultValue={prefeitura.contatoEmail ?? ""} className="form-control mt-1 py-2 text-sm" /></label>
                <label className="text-xs font-semibold text-slate-600">Telefone<input name="contatoFone" maxLength={40} defaultValue={prefeitura.contatoFone ?? ""} className="form-control mt-1 py-2 text-sm" /></label>
                <div className="flex gap-2">
                  <button className="primary-button min-h-9 py-1.5 text-xs">Salvar</button>
                  <Link href={aqui()} scroll={false} className="secondary-button min-h-9 px-3 py-1.5 text-xs">Fechar</Link>
                </div>
              </FormSeguro>
            ) : (
              <DetailList
                items={[
                  { label: "Contato", value: prefeitura.contatoNome ?? "—" },
                  { label: "E-mail", value: prefeitura.contatoEmail ?? "—" },
                  { label: "Telefone", value: prefeitura.contatoFone ?? "—" },
                ]}
              />
            )}
          </Panel>

          <Panel title="Tipos exclusivos" description="Tipos de contrato e de projeto que só aparecem para esta prefeitura.">
            <ul className="flex flex-col gap-1 p-3">
              {prefeitura.fluxosContrato.map((f) => (
                <li key={f.id}>
                  <Link href={`/cadastros/tipos-de-contrato?tipo=${f.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    <ClipboardDocumentListIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate">{f.nome}</span>
                    <span className="text-[11px] text-slate-400">contrato{f.ativo ? "" : " · desativado"}</span>
                  </Link>
                </li>
              ))}
              {prefeitura.tiposProjeto.map((t) => (
                <li key={t.id}>
                  <Link href={`/cadastros/tipos-de-projeto?tipo=${t.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    <RectangleStackIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate">{t.nome}</span>
                    <span className="text-[11px] text-slate-400">projeto</span>
                  </Link>
                </li>
              ))}
              {prefeitura.fluxosContrato.length + prefeitura.tiposProjeto.length === 0 && (
                <li className="px-2 py-1.5 text-xs leading-5 text-slate-400">
                  Nenhum. Para ter um, crie um tipo novo (pode copiar as etapas de outro) e escolha esta prefeitura em “Disponível para”.
                </li>
              )}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
