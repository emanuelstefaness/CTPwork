import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/tenant";
import { Avatar, Panel } from "@/components/ui";
import { FormSeguro } from "@/components/form-seguro";
import { NIVEIS_MEMBRO, gerenciaMembros, type NivelMembro } from "@/lib/membros-projeto";
import { adicionarMembroProjeto, alterarNivelMembroProjeto, removerMembroProjeto } from "@/lib/actions/projetos";

/**
 * Pessoas do CTP no projeto: a responsável e quem foi adicionado para ver ou editar. Quem gerencia
 * contratos adiciona, muda o nível e remove (ver src/lib/membros-projeto.ts).
 */
export async function PessoasDoProjeto({ user, projetoId }: { user: SessaoAtual; projetoId: string }) {
  const projeto = await prisma.projeto.findUniqueOrThrow({
    where: { id: projetoId },
    select: {
      responsavel: { select: { id: true, nome: true } },
      membros: { include: { user: { select: { id: true, nome: true, ativo: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  const gerencia = gerenciaMembros(user);
  const jaNoProjeto = new Set([projeto.responsavel.id, ...projeto.membros.map((m) => m.userId)]);
  const candidatos = gerencia
    ? (await prisma.user.findMany({ where: { tipo: "INTERNO", ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } })).filter((u) => !jaNoProjeto.has(u.id))
    : [];

  return (
    <Panel title="Pessoas no projeto" description="Equipe do CTP que acompanha este projeto.">
      <ul className="divide-y divide-slate-100">
        <li className="flex items-center gap-2.5 px-5 py-3">
          <Avatar name={projeto.responsavel.nome} size="sm" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{projeto.responsavel.nome}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700">Responsável</span>
        </li>
        {projeto.membros.map((m) => {
          const nivel = m.nivel as NivelMembro;
          const outro: NivelMembro = nivel === "EDITAR" ? "VER" : "EDITAR";
          return (
            <li key={m.id} className="px-5 py-3" data-participante={m.user.nome}>
              <div className="flex items-center gap-2.5">
                <Avatar name={m.user.nome} size="sm" />
                <span className={`min-w-0 flex-1 truncate text-xs font-semibold ${m.user.ativo ? "text-slate-800" : "text-slate-400 line-through"}`}>{m.user.nome}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${nivel === "EDITAR" ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-600"}`}>
                  {NIVEIS_MEMBRO[nivel].rotulo}
                </span>
              </div>
              {gerencia && (
                <div className="mt-1.5 flex items-center gap-3 pl-8">
                  <FormSeguro acao={alterarNivelMembroProjeto}>
                    <input type="hidden" name="membroId" value={m.id} />
                    <input type="hidden" name="nivel" value={outro} />
                    <button className="text-[11px] font-semibold text-cyan-700 hover:underline">
                      {outro === "EDITAR" ? "Permitir editar" : "Deixar só ver"}
                    </button>
                  </FormSeguro>
                  <FormSeguro acao={removerMembroProjeto}>
                    <input type="hidden" name="membroId" value={m.id} />
                    <button className="text-[11px] text-slate-400 hover:text-red-600" aria-label={`Remover ${m.user.nome} do projeto`}>Remover</button>
                  </FormSeguro>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {gerencia && (
        candidatos.length > 0 ? (
          <FormSeguro acao={adicionarMembroProjeto} className="flex flex-col gap-2 border-t border-slate-100 p-4">
            <input type="hidden" name="projetoId" value={projetoId} />
            <select name="userId" required aria-label="Pessoa a adicionar" defaultValue="" className="form-control py-2 text-xs">
              <option value="" disabled>Adicionar pessoa…</option>
              {candidatos.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
            <div className="flex gap-2">
              <select name="nivel" aria-label="Nível de acesso" defaultValue="VER" className="form-control flex-1 py-2 text-xs">
                <option value="VER">Ver</option>
                <option value="EDITAR">Ver e editar</option>
              </select>
              <button className="secondary-button min-h-9 px-3 py-1.5 text-xs">Adicionar</button>
            </div>
            <p className="text-[11px] leading-4 text-slate-400">{NIVEIS_MEMBRO.VER.rotulo}: {NIVEIS_MEMBRO.VER.descricao.toLowerCase()} {NIVEIS_MEMBRO.EDITAR.rotulo}: {NIVEIS_MEMBRO.EDITAR.descricao.toLowerCase()}</p>
          </FormSeguro>
        ) : (
          <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">Toda a equipe ativa do CTP já está neste projeto.</p>
        )
      )}
    </Panel>
  );
}
