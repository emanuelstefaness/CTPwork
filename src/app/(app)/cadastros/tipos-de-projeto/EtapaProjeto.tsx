"use client";

import { useState, useTransition } from "react";
import {
  CheckIcon, ChevronDownIcon, ChevronUpIcon, ClipboardDocumentCheckIcon, DocumentTextIcon, InformationCircleIcon, PencilIcon,
  PencilSquareIcon, PlusIcon, TrashIcon, UserGroupIcon, XMarkIcon,
} from "@heroicons/react/24/outline";
import { lerDocumentosPadrao } from "@/lib/documentos-padrao";
import { useEnvio } from "@/components/use-envio";
import { atualizarEtapaModeloSeguro, criarEtapaModeloSeguro, moverEtapaModeloSeguro, removerEtapaModeloSeguro } from "@/lib/actions/formularios";
import { CartaoOpcao, ListaDeDocumentos, Pergunta, QuemFazNoCtp } from "../_ui/Opcoes";

type Etapa = {
  id: string;
  nome: string;
  temInformacoesProjeto: boolean;
  temFormulario: boolean;
  temChecklist: boolean;
  temRevisao: boolean;
  documentosPadrao: string;
  perfisQueConduzem: string;
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

function quemConduzEmTexto(etapa: Pick<Etapa, "perfisQueConduzem">, perfis: PerfilOpcao[]) {
  const nomes = idsDe(etapa.perfisQueConduzem).map((id) => perfis.find((p) => p.id === id)?.nome).filter(Boolean);
  return nomes.length ? `só ${nomes.join(", ")}` : "qualquer pessoa que conduz etapas";
}

/** As perguntas de uma etapa do tipo de projeto — usadas ao criar e ao editar. */
function CamposEtapa({ etapa, perfis }: { etapa?: Etapa; perfis: PerfilOpcao[] }) {
  const [temChecklist, setTemChecklist] = useState(!!etapa?.temChecklist);
  const [temRevisao, setTemRevisao] = useState(!!etapa?.temRevisao);

  return (
    <div className="flex flex-col gap-6">
      <label className="text-xs font-semibold text-slate-600">
        Nome da etapa
        <input name="nome" required maxLength={120} defaultValue={etapa?.nome} placeholder="Ex.: Levantamento de campo" className="form-control mt-1 py-2 text-sm" />
      </label>

      <Pergunta numero={1} titulo="O que acontece nesta etapa?" ajuda="Marque o que se aplica. Toda etapa tem chat entre o CTP e a prefeitura.">
        <div className="grid gap-2 sm:grid-cols-2">
          <CartaoOpcao
            name="temInformacoesProjeto" defaultChecked={etapa?.temInformacoesProjeto}
            icone={InformationCircleIcon} titulo="Dados do projeto e cronograma" descricao="O CTP registra os dados do projeto e monta o cronograma."
          />
          <CartaoOpcao
            name="temFormulario" defaultChecked={etapa?.temFormulario}
            icone={DocumentTextIcon} titulo="Formulário para a prefeitura"
            descricao="A prefeitura responde ao formulário das etapas de projeto (Cadastros › Formulários)."
          />
          <CartaoOpcao
            name="temRevisao" checked={temRevisao} onChange={setTemRevisao}
            icone={PencilSquareIcon} titulo="Revisão de minuta"
            descricao="O CTP escreve a minuta no sistema; a prefeitura grifa, comenta e dá o parecer de cada versão."
          />
          <CartaoOpcao
            name="temChecklist" checked={temChecklist} onChange={setTemChecklist}
            icone={ClipboardDocumentCheckIcon} titulo="Documentos pedidos à prefeitura"
            descricao="A prefeitura envia os arquivos; o CTP confere e aprova cada um."
          >
            {temChecklist && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-600">Pedidos em todo projeto novo</p>
                <ListaDeDocumentos
                  name="documentosPadrao"
                  inicial={lerDocumentosPadrao(etapa?.documentosPadrao)}
                  rotulo="Documento pedido à prefeitura"
                  placeholder="Ex.: Ata da audiência pública"
                  vazio="Nenhum por padrão — o CTP pede na própria etapa."
                />
              </div>
            )}
          </CartaoOpcao>
        </div>
        {/* Uma só forma de revisão hoje: o documento inteiro, no editor do sistema. */}
        <input type="hidden" name="modoRevisao" value="DOCUMENTO_INTEIRO" />
      </Pergunta>

      <Pergunta
        numero={2}
        titulo="Quem conduz esta etapa no CTP?"
        ajuda="Conduzir é iniciar a etapa, pedir ação da prefeitura, definir o prazo, pedir e aprovar documentos e concluir."
      >
        <QuemFazNoCtp
          campo="perfisQueConduzem"
          perfis={perfis}
          marcados={idsDe(etapa?.perfisQueConduzem ?? "[]")}
          rotuloTodos="Qualquer pessoa que conduz etapas"
          descricaoTodos='Perfis com "Gerenciar etapas de projeto" e quem foi adicionado ao projeto para editar.'
        />
      </Pergunta>
    </div>
  );
}

export function EtapaProjetoRow({ etapa, posicao, total, perfis }: { etapa: Etapa; posicao: number; total: number; perfis: PerfilOpcao[] }) {
  const documentos = lerDocumentosPadrao(etapa.documentosPadrao);
  const [editando, setEditando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const { onSubmit, pendente: salvando, erro: erroEdicao } = useEnvio(atualizarEtapaModeloSeguro, () => setEditando(false));
  const final = posicao === total - 1;

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
          <input type="hidden" name="etapaModeloId" value={etapa.id} />
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Editando a etapa {posicao + 1}</p>
          <CamposEtapa etapa={etapa} perfis={perfis} />
          <label className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <input type="checkbox" name="aplicarAosProjetos" defaultChecked className="mt-0.5 h-3.5 w-3.5" />
            <span>Aplicar também às etapas <strong>ainda não iniciadas</strong> dos projetos em andamento deste tipo. Etapas iniciadas ou concluídas não mudam.</span>
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

  const funcoes = [
    etapa.temInformacoesProjeto && "dados e cronograma",
    etapa.temFormulario && "formulário para a prefeitura",
    etapa.temChecklist && (documentos.length ? `${documentos.length} documento${documentos.length === 1 ? "" : "s"} pedido${documentos.length === 1 ? "" : "s"}` : "documentos pedidos na etapa"),
    etapa.temRevisao && "revisão de minuta",
  ].filter(Boolean) as string[];

  return (
    <li data-etapa={etapa.nome} className={`relative flex gap-3 ${pendente ? "opacity-60" : ""}`}>
      <div className="flex flex-col items-center">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{posicao + 1}</span>
        {!final && <span className="w-px flex-1 bg-slate-200" />}
      </div>
      <div className="mb-3 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-[12rem] flex-1">
            <p className="text-sm font-semibold text-slate-900">{etapa.nome}</p>
            <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
              <UserGroupIcon className="mt-px h-3.5 w-3.5 shrink-0 text-cyan-700" />
              <span><strong className="font-semibold text-slate-700">Quem conduz:</strong> {quemConduzEmTexto(etapa, perfis)}</span>
            </p>
            <p className={`mt-0.5 pl-5 text-xs ${funcoes.length ? "text-slate-500" : "font-semibold text-red-600"}`}>
              {funcoes.length ? `Nesta etapa: ${funcoes.join(" · ")}` : "Sem função — só chat"}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button type="button" aria-label="Mover para cima" disabled={posicao === 0 || pendente} onClick={() => rodar(moverEtapaModeloSeguro, { direcao: "up" })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"><ChevronUpIcon className="h-4 w-4" /></button>
            <button type="button" aria-label="Mover para baixo" disabled={final || pendente} onClick={() => rodar(moverEtapaModeloSeguro, { direcao: "down" })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"><ChevronDownIcon className="h-4 w-4" /></button>
            <button type="button" aria-label="Editar etapa" onClick={() => setEditando(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-700"><PencilIcon className="h-4 w-4" /></button>
            <button
              type="button"
              aria-label="Remover etapa"
              onClick={() => { if (confirm(`Remover a etapa "${etapa.nome}" deste tipo? Projetos já criados não são afetados.`)) rodar(removerEtapaModeloSeguro); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            ><TrashIcon className="h-4 w-4" /></button>
          </div>
        </div>
        {erro && <p className="mt-2 text-xs text-red-600" role="alert">{erro}</p>}
      </div>
    </li>
  );
}

export function NovaEtapaProjeto({ tipoId, perfis, aberta = false }: { tipoId: string; perfis: PerfilOpcao[]; aberta?: boolean }) {
  const [aberto, setAberto] = useState(aberta);
  const [versao, setVersao] = useState(0);
  const { onSubmit, pendente, erro } = useEnvio(criarEtapaModeloSeguro, () => setVersao((v) => v + 1));

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="secondary-button self-start border-dashed">
        <PlusIcon className="h-4 w-4" />Nova etapa
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} aria-label="Nova etapa" className="flex flex-col gap-5 rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/30 p-5">
      <input type="hidden" name="tipoProjetoModeloId" value={tipoId} />
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
