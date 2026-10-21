"use client";

import { useState, useTransition } from "react";
import {
  BuildingLibraryIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, PencilSquareIcon, PlusIcon, RocketLaunchIcon,
  TrashIcon, UserGroupIcon, XMarkIcon,
} from "@heroicons/react/24/outline";
import { lerDocumentosPadraoContrato } from "@/lib/documentos-contrato-tipos";
import { useEnvio } from "@/components/use-envio";
import {
  atualizarEtapaFluxoContratoSeguro, criarEtapaFluxoContratoSeguro, moverEtapaFluxoContratoSeguro, removerEtapaFluxoContratoSeguro,
} from "@/lib/actions/formularios";
import { CartaoOpcao, ListaDeDocumentos, Pergunta, QuemFazNoCtp } from "../_ui/Opcoes";

type Etapa = {
  id: string; nome: string; curto: string; exigeAssinaturas: boolean; liberaProjeto: boolean; perfisQueAvancam: string;
  concluidaPelaPrefeitura: boolean; documentosPadrao: string;
};
type PerfilOpcao = { id: string; nome: string };

const idsDe = (json: string) => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
};

/** Em uma frase: quem conclui a etapa. */
function quemConcluiEmTexto(etapa: Pick<Etapa, "concluidaPelaPrefeitura" | "perfisQueAvancam">, perfis: PerfilOpcao[]) {
  if (etapa.concluidaPelaPrefeitura) return "a prefeitura aprova ou devolve com o motivo";
  const nomes = idsDe(etapa.perfisQueAvancam).map((id) => perfis.find((p) => p.id === id)?.nome).filter(Boolean);
  return nomes.length ? `só ${nomes.join(", ")}` : "equipe do CTP (quem gerencia contratos)";
}

/** As perguntas de uma etapa — usadas ao criar e ao editar. */
function CamposEtapa({ etapa, perfis }: { etapa?: Etapa; perfis: PerfilOpcao[] }) {
  const documentos = lerDocumentosPadraoContrato(etapa?.documentosPadrao);
  const [pelaPrefeitura, setPelaPrefeitura] = useState(!!etapa?.concluidaPelaPrefeitura);
  const [assinaturas, setAssinaturas] = useState(!!etapa?.exigeAssinaturas);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
        <label className="text-xs font-semibold text-slate-600">
          Nome da etapa
          <input name="nome" required maxLength={120} defaultValue={etapa?.nome} placeholder="Ex.: Parecer jurídico" className="form-control mt-1 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Nome curto <span className="font-normal text-slate-400">(opcional)</span>
          <input name="curto" maxLength={24} defaultValue={etapa?.curto} placeholder="Ex.: Jurídico" className="form-control mt-1 py-2 text-sm" />
          <span className="mt-1 block font-normal text-slate-400">Aparece na barra de progresso.</span>
        </label>
      </div>

      <Pergunta numero={1} titulo="Quem conclui esta etapa?" ajuda="Concluir leva o contrato para a próxima etapa.">
        <div className="grid gap-2 sm:grid-cols-2">
          <CartaoOpcao
            tipo="radio" name="quemConclui" value="CTP" checked={!pelaPrefeitura} onChange={() => setPelaPrefeitura(false)}
            icone={UserGroupIcon} titulo="Equipe do CTP" descricao="Alguém do CTP confere e avança o contrato."
          />
          <CartaoOpcao
            tipo="radio" name="quemConclui" value="PREFEITURA" checked={pelaPrefeitura} onChange={() => { setPelaPrefeitura(true); setAssinaturas(false); }}
            icone={BuildingLibraryIcon} titulo="A prefeitura"
            descricao="Ela aprova, ou devolve à etapa anterior dizendo o motivo. Ex.: aprovação do orçamento."
          />
        </div>
        {pelaPrefeitura ? (
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-900">
            Na prefeitura, decide quem tem a permissão &quot;Aprovar etapas do contrato&quot; (Cadastros › Perfis de acesso).
          </p>
        ) : (
          <div className="border-l-2 border-cyan-200 pl-3 sm:ml-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">Quem da equipe?</p>
            <QuemFazNoCtp
              campo="perfisQueAvancam"
              perfis={perfis}
              marcados={idsDe(etapa?.perfisQueAvancam ?? "[]")}
              rotuloTodos="Qualquer pessoa que gerencia contratos"
              descricaoTodos='Perfis com a permissão "Gerenciar contratos".'
            />
          </div>
        )}
      </Pergunta>

      <Pergunta numero={2} titulo="O que acontece nesta etapa?" ajuda="Marque o que se aplica. Sem nada marcado, a etapa é só um passo do acompanhamento.">
        <div className="grid gap-2 sm:grid-cols-2">
          <CartaoOpcao
            name="exigeAssinaturas" checked={assinaturas} onChange={setAssinaturas} disabled={pelaPrefeitura}
            icone={PencilSquareIcon} titulo="Coleta de assinaturas"
            descricao={pelaPrefeitura ? "Só em etapas que a equipe do CTP conclui." : "Aqui se abre a coleta; o contrato só avança com todas as assinaturas."}
          />
          <CartaoOpcao
            name="liberaProjeto" defaultChecked={etapa?.liberaProjeto}
            icone={RocketLaunchIcon} titulo="Libera o projeto técnico" descricao="A partir desta etapa já dá para criar o projeto."
          />
        </div>
      </Pergunta>

      <Pergunta numero={3} titulo="Documentos pedidos nesta etapa" ajuda="Pedidos automaticamente em todo contrato novo deste tipo. A etapa só avança com todos aprovados.">
        <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><BuildingLibraryIcon className="h-4 w-4 text-violet-600" />A prefeitura envia</p>
            <ListaDeDocumentos
              name="docsPrefeitura"
              inicial={documentos.filter((d) => d.enviaQuem === "PREFEITURA").map((d) => d.nome)}
              rotulo="Documento que a prefeitura envia"
              placeholder="Ex.: Termo de referência assinado"
              vazio="Nenhum documento."
            />
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><UserGroupIcon className="h-4 w-4 text-cyan-700" />O CTP envia</p>
            <ListaDeDocumentos
              name="docsCtp"
              inicial={documentos.filter((d) => d.enviaQuem === "CTP").map((d) => d.nome)}
              rotulo="Documento que o CTP envia"
              placeholder="Ex.: Proposta de orçamento"
              vazio="Nenhum documento."
            />
          </div>
        </div>
      </Pergunta>
    </div>
  );
}

export function EtapaContratoRow({ etapa, posicao, total, perfis }: { etapa: Etapa; posicao: number; total: number; perfis: PerfilOpcao[] }) {
  const documentos = lerDocumentosPadraoContrato(etapa.documentosPadrao);
  const daPrefeitura = documentos.filter((d) => d.enviaQuem === "PREFEITURA").length;
  const doCtp = documentos.length - daPrefeitura;
  const [editando, setEditando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const { onSubmit, pendente: salvando, erro: erroEdicao } = useEnvio(atualizarEtapaFluxoContratoSeguro, () => setEditando(false));
  // Com 2 etapas ou mais, a última é o estado final (chegar nela conclui o contrato).
  const final = total >= 2 && posicao === total - 1;

  const rodar = (acao: (d: FormData) => Promise<{ ok: boolean; erro?: string }>, extra: Record<string, string> = {}) =>
    iniciar(async () => {
      const dados = new FormData();
      dados.set("etapaId", etapa.id);
      for (const [k, v] of Object.entries(extra)) dados.set(k, v);
      const r = await acao(dados);
      setErro(r.ok ? null : r.erro ?? "Não foi possível salvar.");
    });

  if (editando) {
    return (
      <li data-etapa={etapa.nome}>
        <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="etapaId" value={etapa.id} />
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Editando a etapa {posicao + 1}</p>
          <CamposEtapa etapa={etapa} perfis={perfis} />
          <label className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <input type="checkbox" name="aplicarAosContratos" defaultChecked className="mt-0.5 h-3.5 w-3.5" />
            <span>Aplicar também aos contratos em andamento que <strong>ainda não passaram</strong> desta etapa (quem conclui e documentos que faltarem).</span>
          </label>
          {erroEdicao && <p className="text-xs text-red-600" role="alert">{erroEdicao}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={salvando} className="primary-button min-h-9 px-3 py-1.5 text-xs"><CheckIcon className="h-3.5 w-3.5" />{salvando ? "Salvando…" : "Salvar etapa"}</button>
            <button type="button" onClick={() => setEditando(false)} className="secondary-button min-h-9 px-3 py-1.5 text-xs"><XMarkIcon className="h-3.5 w-3.5" />Cancelar</button>
          </div>
        </form>
      </li>
    );
  }

  const efeitos = [
    etapa.exigeAssinaturas && "coleta as assinaturas",
    etapa.liberaProjeto && "libera o projeto técnico",
    daPrefeitura > 0 && `prefeitura envia ${daPrefeitura} documento${daPrefeitura === 1 ? "" : "s"}`,
    doCtp > 0 && `CTP envia ${doCtp} documento${doCtp === 1 ? "" : "s"}`,
  ].filter(Boolean) as string[];

  return (
    <li data-etapa={etapa.nome} className={`relative flex gap-3 ${pendente ? "opacity-60" : ""}`}>
      {/* Linha do tempo: número da etapa e o traço até a próxima. */}
      <div className="flex flex-col items-center">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${final ? "bg-emerald-100 text-emerald-700" : "bg-slate-900 text-white"}`}>{posicao + 1}</span>
        {posicao < total - 1 && <span className="w-px flex-1 bg-slate-200" />}
      </div>
      <div className="mb-3 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-[12rem] flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {etapa.nome}
              {final && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">etapa final</span>}
            </p>
            {/* A última etapa é o estado final: chegar nela já conclui o contrato. */}
            <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
              {etapa.concluidaPelaPrefeitura && !final ? <BuildingLibraryIcon className="mt-px h-3.5 w-3.5 shrink-0 text-violet-600" /> : <UserGroupIcon className="mt-px h-3.5 w-3.5 shrink-0 text-cyan-700" />}
              {final
                ? <span>Ao chegar aqui, o contrato está concluído.</span>
                : <span><strong className="font-semibold text-slate-700">Quem conclui:</strong> {quemConcluiEmTexto(etapa, perfis)}</span>}
            </p>
            {efeitos.length > 0 && <p className="mt-0.5 pl-5 text-xs text-slate-500">Nesta etapa: {efeitos.join(" · ")}</p>}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button type="button" aria-label="Mover para cima" disabled={posicao === 0 || pendente} onClick={() => rodar(moverEtapaFluxoContratoSeguro, { direcao: "up" })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"><ChevronUpIcon className="h-4 w-4" /></button>
            <button type="button" aria-label="Mover para baixo" disabled={posicao === total - 1 || pendente} onClick={() => rodar(moverEtapaFluxoContratoSeguro, { direcao: "down" })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"><ChevronDownIcon className="h-4 w-4" /></button>
            <button type="button" aria-label="Editar etapa" onClick={() => setEditando(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-700"><PencilIcon className="h-4 w-4" /></button>
            <button
              type="button"
              aria-label="Remover etapa"
              onClick={() => { if (confirm(`Remover a etapa "${etapa.nome}"? Contratos já criados não são afetados.`)) rodar(removerEtapaFluxoContratoSeguro); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            ><TrashIcon className="h-4 w-4" /></button>
          </div>
        </div>
        {erro && <p className="mt-2 text-xs text-red-600" role="alert">{erro}</p>}
      </div>
    </li>
  );
}

/** "Nova etapa": o formulário só aparece quando chamado (ou já aberto, se o tipo não tem etapas). */
export function NovaEtapaContrato({ fluxoId, perfis, aberta = false }: { fluxoId: string; perfis: PerfilOpcao[]; aberta?: boolean }) {
  const [aberto, setAberto] = useState(aberta);
  const [versao, setVersao] = useState(0);
  const { onSubmit, pendente, erro } = useEnvio(criarEtapaFluxoContratoSeguro, () => setVersao((v) => v + 1));

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="secondary-button self-start border-dashed">
        <PlusIcon className="h-4 w-4" />Nova etapa
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} aria-label="Nova etapa" className="flex flex-col gap-5 rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/30 p-5">
      <input type="hidden" name="fluxoId" value={fluxoId} />
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Nova etapa (entra no fim)</p>
      <CamposEtapa key={versao} perfis={perfis} />
      {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pendente} className="primary-button"><PlusIcon className="h-4 w-4" />{pendente ? "Adicionando…" : "Adicionar etapa"}</button>
        <button type="button" onClick={() => setAberto(false)} className="secondary-button">Fechar</button>
      </div>
    </form>
  );
}
