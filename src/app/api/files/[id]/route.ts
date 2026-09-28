import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireSession, assertAcessoContratante } from "@/lib/tenant";
import { pastaUploads } from "@/lib/pastas";
import { podeVerContrato, podeVerProjeto } from "@/lib/visibilidade";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const anexo = await prisma.anexo.findUnique({
    where: { id },
    include: {
      contrato: true,
      memorando: true,
      checklistItem: { include: { etapa: { include: { projeto: true } } } },
      documentoVersao: { include: { etapa: { include: { projeto: true } } } },
      mensagemChat: { include: { etapa: { include: { projeto: true } } } },
      mensagemConversa: { include: { conversa: true } },
    },
  });
  if (!anexo) return new Response("Arquivo não encontrado", { status: 404 });
  if (anexo.memorando && user.tipo !== "INTERNO") return new Response("Acesso negado", { status: 403 });
  const contratanteId =
    anexo.contrato?.contratanteId ??
    anexo.checklistItem?.etapa.projeto.contratanteId ??
    anexo.documentoVersao?.etapa.projeto.contratanteId ??
    anexo.mensagemChat?.etapa.projeto.contratanteId ??
    anexo.mensagemConversa?.conversa.municipioId;
  if (contratanteId) {
    try {
      assertAcessoContratante(user, contratanteId);
    } catch {
      return new Response("Acesso negado", { status: 403 });
    }
  }
  if (!contratanteId && !anexo.memorando) return new Response("Arquivo sem vínculo autorizado", { status: 403 });
  // Perfil "vê só onde participa": anexos de projetos/contratos que a pessoa não acompanha ficam fechados.
  const projetoId = anexo.checklistItem?.etapa.projetoId ?? anexo.documentoVersao?.etapa.projetoId ?? anexo.mensagemChat?.etapa.projetoId;
  if (projetoId && !(await podeVerProjeto(user, projetoId))) return new Response("Acesso negado", { status: 403 });
  if (anexo.contratoId && !(await podeVerContrato(user, anexo.contratoId))) return new Response("Acesso negado", { status: 403 });

  try {
    const bytes = await readFile(path.join(pastaUploads(), anexo.id));
    return new Response(bytes, {
      headers: {
        "Content-Type": anexo.tipoMime,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(anexo.nomeOriginal)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Arquivo indisponível", { status: 404 });
  }
}
