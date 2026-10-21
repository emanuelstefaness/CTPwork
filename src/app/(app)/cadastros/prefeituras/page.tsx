import type { Metadata } from "next";
import Link from "next/link";
import { BuildingLibraryIcon, ChevronRightIcon, PlusIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { PageHeader, Panel } from "@/components/ui";
import { CampoBusca } from "../_ui/CampoBusca";
import { combina } from "../_ui/busca";

export const metadata: Metadata = { title: "Prefeituras" };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default async function PrefeiturasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await exigirPermissao("cadastros");
  const { q } = await searchParams;
  const prefeituras = await prisma.municipio.findMany({
    orderBy: { nome: "asc" },
    include: {
      _count: { select: { usuariosExternos: { where: { ativo: true } }, contratos: true, projetos: true } },
      fluxosContrato: { select: { id: true } },
      tiposProjeto: { select: { id: true } },
    },
  });
  const lista = prefeituras.filter((m) => combina(q, m.nome, m.contatoNome, m.contatoEmail));

  return (
    <>
      <PageHeader
        title="Prefeituras"
        description="Os clientes do CTP. Cada prefeitura só vê os próprios contratos e projetos. Abra uma para editar os dados e as pessoas que têm acesso."
        actions={<Link href="/cadastros/prefeituras/nova" className="primary-button"><PlusIcon className="h-4 w-4" />Nova prefeitura</Link>}
      />
      <Panel>
        <div className="border-b border-slate-100 px-5 py-4">
          <CampoBusca valor={q} placeholder="Buscar prefeitura ou contato" rotulo="Buscar prefeitura" />
        </div>
        <ul className="divide-y divide-slate-100">
          {lista.map((m) => {
            const exclusivos = m.fluxosContrato.length + m.tiposProjeto.length;
            return (
              <li key={m.id}>
                <Link href={`/cadastros/prefeituras/${m.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><BuildingLibraryIcon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{m.nome}</span>
                    <span className="block truncate text-xs text-slate-400">{m.contatoNome ?? "Sem contato definido"}{m.contatoEmail ? ` · ${m.contatoEmail}` : ""}</span>
                  </span>
                  <span className="hidden shrink-0 flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-slate-500 sm:flex">
                    <span>{plural(m._count.usuariosExternos, "acesso", "acessos")}</span>
                    <span>{plural(m._count.contratos, "contrato", "contratos")}</span>
                    <span>{plural(m._count.projetos, "projeto", "projetos")}</span>
                    {exclusivos > 0 && <span className="font-semibold text-violet-700">{plural(exclusivos, "tipo exclusivo", "tipos exclusivos")}</span>}
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300" />
                </Link>
              </li>
            );
          })}
          {lista.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-slate-400">
              {q ? `Nenhuma prefeitura encontrada para “${q}”.` : "Nenhuma prefeitura cadastrada. Use “Nova prefeitura” para cadastrar a primeira."}
            </li>
          )}
        </ul>
      </Panel>
    </>
  );
}
