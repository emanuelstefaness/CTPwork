import { ArrowTopRightOnSquareIcon, DocumentTextIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Badge, Panel, ProgressBar } from "@/components/ui";
import { FormSeguro } from "@/components/form-seguro";
import { EnviarArquivo } from "@/components/enviar-arquivo";
import {
  aprovarDocumentoContratoSeguro, enviarDocumentoContratoSeguro, pedirDocumentoContratoSeguro, recusarDocumentoContratoSeguro, removerDocumentoContratoSeguro,
} from "@/lib/actions/formularios";
import { formatarDiaDoEvento } from "@/lib/formatters";

export type DocumentoDaEtapa = {
  id: string;
  nome: string;
  enviaQuem: string;
  status: string;
  motivoRecusa: string | null;
  enviadoEm: Date | null;
  anexo: { id: string; nomeOriginal: string } | null;
};

const rotuloStatus = (d: DocumentoDaEtapa) =>
  d.status === "APROVADO" ? (d.enviaQuem === "CTP" ? "Entregue" : "Aprovado") : d.status === "ENVIADO" ? "Em análise" : "Pendente";
const tomStatus = (status: string) => (status === "APROVADO" ? "emerald" : status === "ENVIADO" ? "blue" : "amber");

/**
 * Documentos pedidos na etapa atual do contrato: quem envia cada um, situação, arquivo e as ações
 * que cabem a quem está vendo (enviar, aprovar, recusar com motivo, pedir outro, remover).
 */
export function DocumentosDaEtapa({ contratoId, etapaNome, documentos, isInterno, gerencia, enviaDocumentos }: {
  contratoId: string;
  etapaNome: string;
  documentos: DocumentoDaEtapa[];
  isInterno: boolean;
  gerencia: boolean;
  enviaDocumentos: boolean;
}) {
  const aprovados = documentos.filter((d) => d.status === "APROVADO").length;
  const podeEnviar = (d: DocumentoDaEtapa) => d.status !== "APROVADO" && (isInterno ? gerencia : enviaDocumentos && d.enviaQuem === "PREFEITURA");

  return (
    <Panel
      title="Documentos da etapa"
      description={`${etapaNome}: ${isInterno ? "o que cada lado precisa entregar. A etapa só avança com todos aprovados." : "o que a prefeitura precisa enviar; o CTP confere e aprova cada um."} ${aprovados} de ${documentos.length} concluídos.`}
      action={documentos.length > 0 ? <span className="w-24"><ProgressBar value={Math.round((aprovados / documentos.length) * 100)} tone="emerald" /></span> : undefined}
    >
      <div className="divide-y divide-slate-100">
        {documentos.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500"><DocumentTextIcon className="h-4 w-4" /></span>
            <div className="min-w-[180px] flex-1">
              <p className="text-sm font-semibold text-slate-800">{d.nome}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {d.enviaQuem === "CTP" ? "Quem envia: CTP" : "Quem envia: prefeitura"}
                {d.anexo && d.enviadoEm ? ` · enviado em ${formatarDiaDoEvento(d.enviadoEm)}` : ""}
              </p>
              {d.anexo && (
                <a href={`/api/files/${d.anexo.id}`} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex max-w-full items-center gap-1 text-xs text-cyan-700">
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{d.anexo.nomeOriginal}</span>
                </a>
              )}
              {d.status === "PENDENTE" && d.motivoRecusa && (
                <p className="mt-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">Pedido de novo envio: {d.motivoRecusa}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Badge tone={tomStatus(d.status)}>{rotuloStatus(d)}</Badge>
              {podeEnviar(d) && <EnviarArquivo acao={enviarDocumentoContratoSeguro} campos={{ documentoId: d.id }} rotulo={d.anexo ? "Enviar outro" : "Enviar arquivo"} />}
              {gerencia && d.status === "ENVIADO" && (
                <FormSeguro acao={aprovarDocumentoContratoSeguro}>
                  <input type="hidden" name="documentoId" value={d.id} />
                  <button className="secondary-button min-h-8 border-emerald-200 px-2.5 py-1 text-[11px] text-emerald-700">Aprovar</button>
                </FormSeguro>
              )}
              {gerencia && d.status === "PENDENTE" && !d.anexo && (
                <FormSeguro acao={removerDocumentoContratoSeguro}>
                  <input type="hidden" name="documentoId" value={d.id} />
                  <button className="min-h-8 rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-red-50 hover:text-red-600">Remover</button>
                </FormSeguro>
              )}
            </div>
            {gerencia && d.status === "ENVIADO" && (
              <details className="w-full pl-12">
                <summary className="cursor-pointer text-[11px] font-medium text-slate-400 hover:text-slate-600">Recusar e pedir de novo…</summary>
                <FormSeguro acao={recusarDocumentoContratoSeguro} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="documentoId" value={d.id} />
                  <input name="motivo" required aria-label={`Motivo da recusa de ${d.nome}`} placeholder="O que está errado ou faltando" className="form-control min-w-0 flex-1 py-2 text-xs" />
                  <button className="secondary-button min-h-9 border-red-200 py-1.5 text-xs text-red-700">Recusar</button>
                </FormSeguro>
              </details>
            )}
          </div>
        ))}
        {documentos.length === 0 && <p className="px-5 py-8 text-center text-xs text-slate-400">Nenhum documento pedido nesta etapa.</p>}
      </div>
      {gerencia && (
        <FormSeguro acao={pedirDocumentoContratoSeguro} className="border-t border-slate-100 p-3">
          <input type="hidden" name="contratoId" value={contratoId} />
          <div className="flex flex-wrap gap-2">
            <input name="nome" required aria-label="Documento a pedir" placeholder="Pedir outro documento nesta etapa" className="form-control min-w-[200px] flex-1 py-2 text-xs" />
            <select name="enviaQuem" aria-label="Quem envia" defaultValue="PREFEITURA" className="form-control w-auto py-2 text-xs">
              <option value="PREFEITURA">Prefeitura envia</option>
              <option value="CTP">CTP envia</option>
            </select>
            <button className="secondary-button min-h-9 px-3 py-1.5 text-xs"><PlusIcon className="h-4 w-4" />Pedir</button>
          </div>
        </FormSeguro>
      )}
    </Panel>
  );
}
