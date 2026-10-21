import type { Metadata } from "next";
import Link from "next/link";
import { BuildingLibraryIcon, DocumentTextIcon, PlusIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { PageHeader, Panel } from "@/components/ui";
import { atualizarModeloFormularioSeguro, criarModeloFormularioSeguro } from "@/lib/actions/formularios";
import FormularioEditor from "./FormularioEditor";

export const metadata: Metadata = { title: "Formulários" };

type Campo = { chave: string; label: string; tipo: string; obrigatorio: boolean };
const lerCampos = (json: string): Campo[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

function Linha({ m, ativo }: { m: { id: string; nome: string; campos: string }; ativo: boolean }) {
  const campos = lerCampos(m.campos);
  return (
    <div data-formulario={m.nome} className={`flex items-start justify-between gap-3 px-5 py-3.5 ${ativo ? "bg-cyan-50/60" : ""}`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{m.nome}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{campos.length} campo{campos.length === 1 ? "" : "s"}: {campos.map((c) => c.label).join(", ")}</p>
      </div>
      <Link href={`/cadastros/formularios?editar=${m.id}`} scroll={false} className="secondary-button min-h-8 shrink-0 px-3 py-1 text-[11px]">Editar</Link>
    </div>
  );
}

/**
 * Formulários: modelos de memorando (vários) e o formulário que a prefeitura responde nas etapas de
 * projeto com "Formulário para a prefeitura" (um só — gravado como tipo CONTRATO).
 */
export default async function FormulariosPage({ searchParams }: { searchParams: Promise<{ editar?: string; novo?: string }> }) {
  await exigirPermissao("cadastros");
  const { editar, novo } = await searchParams;
  const modelos = await prisma.modeloFormulario.findMany({ orderBy: [{ createdAt: "asc" }] });
  const memorandos = modelos.filter((m) => m.tipo === "MEMORANDO").sort((a, b) => a.nome.localeCompare(b.nome));
  const daEtapa = modelos.find((m) => m.tipo === "CONTRATO");
  const editando = modelos.find((m) => m.id === editar);
  const criando = novo === "MEMORANDO" || (novo === "CONTRATO" && !daEtapa) ? (novo as "MEMORANDO" | "CONTRATO") : undefined;

  return (
    <>
      <PageHeader
        title="Formulários"
        description="Perguntas prontas para padronizar pedidos: nos memorandos internos e nas etapas de projeto em que a prefeitura preenche informações."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-5 self-start">
          <Panel
            title="Modelos de memorando"
            description="Aparecem no campo “Modelo” ao escrever um memorando."
            action={<Link href="/cadastros/formularios?novo=MEMORANDO" scroll={false} className="secondary-button min-h-8 shrink-0 whitespace-nowrap px-3 py-1 text-xs"><PlusIcon className="h-3.5 w-3.5" />Novo modelo</Link>}
          >
            <div className="divide-y divide-slate-100">
              {memorandos.map((m) => <Linha key={m.id} m={m} ativo={editando?.id === m.id} />)}
              {memorandos.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-400">Nenhum modelo de memorando ainda.</p>}
            </div>
          </Panel>

          <Panel title="Formulário das etapas de projeto" description="O que a prefeitura responde nas etapas marcadas com “Formulário para a prefeitura” (em Tipos de projeto). É um só para todos os projetos.">
            {daEtapa ? (
              <Linha m={daEtapa} ativo={editando?.id === daEtapa.id} />
            ) : (
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <p className="text-sm text-slate-500">Ainda não criado: as etapas com formulário ficam sem perguntas.</p>
                <Link href="/cadastros/formularios?novo=CONTRATO" scroll={false} className="primary-button min-h-8 shrink-0 px-3 py-1 text-xs"><PlusIcon className="h-3.5 w-3.5" />Criar</Link>
              </div>
            )}
          </Panel>
        </div>

        {editando || criando ? (
          <Panel
            title={editando ? `Editar — ${editando.nome}` : criando === "MEMORANDO" ? "Novo modelo de memorando" : "Formulário das etapas de projeto"}
            description={(editando?.tipo ?? criando) === "MEMORANDO" ? "Quem escreve o memorando preenche estes campos." : "A prefeitura preenche estes campos na etapa do projeto."}
            action={(editando?.tipo ?? criando) === "MEMORANDO" ? <DocumentTextIcon className="h-5 w-5 text-blue-500" /> : <BuildingLibraryIcon className="h-5 w-5 text-violet-500" />}
          >
            <div className="p-5">
              <FormularioEditor
                key={editando?.id ?? criando}
                tipo={(editando?.tipo ?? criando) as "MEMORANDO" | "CONTRATO"}
                modelo={editando ? { id: editando.id, nome: editando.nome, tipo: editando.tipo, campos: lerCampos(editando.campos) } : undefined}
                acao={editando ? atualizarModeloFormularioSeguro : criarModeloFormularioSeguro}
                voltarPara="/cadastros/formularios"
              />
            </div>
          </Panel>
        ) : (
          <div className="hidden rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400 xl:block">
            Escolha um formulário para editar, ou crie um novo.
          </div>
        )}
      </div>
    </>
  );
}
