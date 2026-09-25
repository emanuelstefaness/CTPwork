"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArchiveBoxIcon, ArrowPathIcon, PaperAirplaneIcon, PaperClipIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEnvio } from "@/components/use-envio";
import { alterarStatusConversa, enviarMensagemConversa } from "@/lib/actions/conversas";

/** Busca mensagens novas a cada 20 s enquanto a aba está visível (não é tempo real, mas quase). */
export function AtualizacaoAutomatica({ intervalo = 20_000 }: { intervalo?: number }) {
  const router = useRouter();
  useEffect(() => {
    // O layout (contador de não lidas no menu) é renderizado junto com a página, antes de ela marcar
    // a conversa como lida; uma atualização logo ao abrir zera o contador.
    router.refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalo);
    return () => window.clearInterval(id);
  }, [router, intervalo]);
  return null;
}

/** Mantém a conversa rolada até a mensagem mais recente, como em qualquer app de mensagens. */
export function RolarParaFim({ total, className, children }: { total: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [total]);
  return <div ref={ref} className={className}>{children}</div>;
}

export function RespostaConversa({ conversaId, encerrada, destino }: { conversaId: string; encerrada: boolean; destino: string }) {
  const [arquivo, setArquivo] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { onSubmit, pendente, erro } = useEnvio(enviarMensagemConversa, (form) => { form.reset(); setArquivo(null); });

  return (
    <form ref={formRef} onSubmit={onSubmit} className="border-t border-slate-200 bg-white p-3 sm:p-4">
      <input type="hidden" name="conversaId" value={conversaId} />
      {encerrada && <p className="mb-2 text-xs text-slate-500">Esta conversa está encerrada. Enviar uma mensagem a reabre.</p>}
      <textarea
        name="texto"
        rows={3}
        maxLength={10000}
        aria-label="Mensagem"
        placeholder={`Escreva para ${destino}…`}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) formRef.current?.requestSubmit(); }}
        className="form-control resize-y text-sm"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="secondary-button min-h-9 cursor-pointer px-3 py-1.5 text-xs" title="Anexar arquivo (até 20 MB)">
          <PaperClipIcon className="h-4 w-4" />
          <span className="max-w-[180px] truncate">{arquivo ?? "Anexar"}</span>
          <input type="file" name="arquivo" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" className="sr-only" onChange={(e) => setArquivo(e.target.files?.[0]?.name ?? null)} />
        </label>
        {arquivo && (
          <button
            type="button"
            aria-label="Remover anexo"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => { const input = formRef.current?.elements.namedItem("arquivo") as HTMLInputElement | null; if (input) input.value = ""; setArquivo(null); }}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
        {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}
        <span className="ml-auto hidden text-[11px] text-slate-400 sm:inline">Ctrl + Enter envia</span>
        <button type="submit" disabled={pendente} className="primary-button min-h-9 px-4 py-1.5 text-sm">
          <PaperAirplaneIcon className="h-4 w-4" />
          {pendente ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}

export function StatusConversa({ conversaId, encerrada }: { conversaId: string; encerrada: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const alternar = () =>
    iniciar(async () => {
      if (!encerrada && !confirm("Encerrar esta conversa? Ela sai da lista de abertas, mas qualquer nova mensagem a reabre.")) return;
      const r = await alterarStatusConversa(conversaId, encerrada ? "ABERTA" : "ENCERRADA");
      setErro(r.ok ? null : r.erro);
    });
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button type="button" onClick={alternar} disabled={pendente} className="secondary-button">
        {encerrada ? <><ArrowPathIcon className="h-4 w-4" />Reabrir conversa</> : <><ArchiveBoxIcon className="h-4 w-4" />Encerrar conversa</>}
      </button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
