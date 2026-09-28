"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-1 text-sm font-medium text-red-800">Não foi possível concluir a ação</p>
        {/* Em produção o Next troca a mensagem de erros do servidor por um texto técnico ("Minified
           React error…"); nesse caso mostramos uma mensagem humana e o código para o suporte. */}
        <p className="mb-4 text-sm text-red-600">
          {error.digest || /Minified React error|Server Components render/i.test(error.message ?? "")
            ? "Ocorreu um erro inesperado. Tente de novo; se continuar, avise a equipe do CTP."
            : error.message || "Ocorreu um erro inesperado."}
          {error.digest && <span className="mt-1 block text-[11px] text-red-400">Código: {error.digest}</span>}
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Tentar novamente
          </button>
          {/* Navegação completa (não apenas reset do boundary) — necessário quando o erro vem de uma
             sessão inválida: reset() sozinho re-executaria a mesma ação com o mesmo cookie quebrado. */}
          <a
            href="/login"
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Fazer login novamente
          </a>
        </div>
      </div>
    </div>
  );
}
