import Link from "next/link";
import { EyeSlashIcon, LockClosedIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Badge, Panel } from "@/components/ui";
import { FormSeguro } from "@/components/form-seguro";
import { atualizarPerfilSeguro, criarPerfilSeguro, excluirPerfilSeguro } from "@/lib/actions/formularios";
import { PERMISSOES, lerPermissoes, permissoesDoTipo, type TipoPerfil } from "@/lib/permissoes";

type PerfilLinha = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  permissoes: string;
  somenteParticipa: boolean;
  sistema: boolean;
  _count: { usuarios: number };
};

const ROTULO_TIPO: Record<string, string> = { INTERNO: "Equipe do CTP", EXTERNO: "Prefeitura" };

/** Cadastros › Perfis: cargos com o que cada um vê e faz. */
export function AbaPerfis({ perfis, selecionado }: { perfis: PerfilLinha[]; selecionado?: PerfilLinha }) {
  const marcadas = selecionado ? lerPermissoes(selecionado.permissoes, selecionado.tipo) : [];
  const disponiveis = selecionado ? permissoesDoTipo(selecionado.tipo as TipoPerfil) : [];
  const grupos = [...new Set(disponiveis.map((p) => PERMISSOES[p].grupo))];

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        {(["INTERNO", "EXTERNO"] as const).map((tipo) => (
          <Panel key={tipo} title={ROTULO_TIPO[tipo]}>
            <div className="flex flex-col gap-1 p-2">
              {perfis.filter((p) => p.tipo === tipo).map((p) => (
                <Link
                  key={p.id}
                  href={`/cadastros?aba=perfis&perfil=${p.id}`}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    selecionado?.id === p.id ? "bg-cyan-50 font-semibold text-cyan-800" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{p.nome}</span>
                    {p.sistema && <LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="perfil de fábrica" />}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">{p._count.usuarios} pessoa(s)</span>
                </Link>
              ))}
            </div>
          </Panel>
        ))}
        <Panel title="Novo perfil">
          <FormSeguro acao={criarPerfilSeguro} className="flex flex-col gap-3 p-5">
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
            <button className="primary-button self-start"><PlusIcon className="h-4 w-4" />Criar perfil</button>
          </FormSeguro>
        </Panel>
      </div>

      {selecionado && (
        <Panel
          title={`Perfil — ${selecionado.nome}`}
          description={`${ROTULO_TIPO[selecionado.tipo]} · ${selecionado._count.usuarios} pessoa(s) com este perfil. Mudanças valem no próximo clique de cada pessoa.`}
          action={selecionado.sistema ? <Badge tone="slate">De fábrica</Badge> : undefined}
        >
          <FormSeguro key={selecionado.id} acao={atualizarPerfilSeguro} limparAoEnviar={false} className="flex flex-col gap-5 p-5" erroClassName="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <input type="hidden" name="perfilId" value={selecionado.id} />
            <div className="grid gap-3 sm:grid-cols-[240px_minmax(0,1fr)]">
              <label className="text-xs font-semibold text-slate-600">
                Nome
                <input name="nome" required maxLength={60} defaultValue={selecionado.nome} className="form-control mt-1 py-2 text-sm" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Descrição
                <input name="descricao" maxLength={200} defaultValue={selecionado.descricao ?? ""} placeholder="Para quem é este perfil" className="form-control mt-1 py-2 text-sm" />
              </label>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">O que este perfil pode fazer</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {selecionado.tipo === "EXTERNO"
                  ? "Todo usuário da prefeitura vê os projetos, contratos e conversas do seu município. Marque o que ele pode fazer além disso."
                  : "Todo colaborador vê memorandos, conversas e o chat das etapas. Marque o que ele pode fazer além disso."}
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

            {selecionado.tipo === "INTERNO" && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
                <input type="checkbox" name="somenteParticipa" defaultChecked={selecionado.somenteParticipa} className="mt-0.5 h-4 w-4 accent-amber-600" />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><EyeSlashIcon className="h-4 w-4 text-amber-700" />Vê só os contratos e projetos em que participa</span>
                  <span className="block text-xs leading-5 text-slate-600">Onde é responsável, responsável por alguma etapa ou signatário. Os demais somem das listas, dos prazos e dos arquivos.</span>
                </span>
              </label>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <button className="primary-button">Salvar perfil</button>
              <span className="text-xs text-slate-400">O sistema não deixa ficar sem ninguém com acesso a Cadastros.</span>
            </div>
          </FormSeguro>
          {!selecionado.sistema && (
            <FormSeguro acao={excluirPerfilSeguro} className="border-t border-slate-100 px-5 py-3">
              <input type="hidden" name="perfilId" value={selecionado.id} />
              <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline" disabled={selecionado._count.usuarios > 0} title={selecionado._count.usuarios > 0 ? "Mude o perfil das pessoas antes de excluir." : undefined}>
                <TrashIcon className="h-3.5 w-3.5" />Excluir perfil{selecionado._count.usuarios > 0 ? ` (em uso por ${selecionado._count.usuarios})` : ""}
              </button>
            </FormSeguro>
          )}
        </Panel>
      )}
    </div>
  );
}
