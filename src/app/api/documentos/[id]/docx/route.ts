import { prisma } from "@/lib/prisma";
import { requireSession, assertAcessoContratante, AcessoNegadoError } from "@/lib/tenant";
import { lerDocumento } from "@/lib/editor/servidor";
import { gerarDocx } from "@/lib/editor/docx";
import type { TipoAnotacao } from "@/lib/editor/extensoes";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return new Response("Não autenticado", { status: 401 });
  }
  const { id } = await params;
  const documento = await prisma.documentoVersionado.findUnique({
    where: { id },
    include: {
      etapa: { include: { projeto: true } },
      anotacoes: { include: { autor: true, respostas: { include: { autor: true }, orderBy: { createdAt: "asc" } } }, orderBy: { de: "asc" } },
    },
  });
  if (!documento || !documento.conteudo) return new Response("Documento não encontrado", { status: 404 });
  try {
    assertAcessoContratante(user, documento.etapa.projeto.contratanteId);
  } catch (e) {
    if (e instanceof AcessoNegadoError) return new Response("Acesso negado", { status: 403 });
    throw e;
  }
  if (!documento.enviadoEm && user.tipo !== "INTERNO") return new Response("Documento não disponível", { status: 403 });

  const titulo = documento.titulo ?? documento.nomeArquivo;
  const buffer = await gerarDocx({
    doc: lerDocumento(documento.conteudo),
    titulo,
    subtitulo: `${documento.etapa.projeto.codigo} · ${documento.etapa.nome} · ${documento.enviadoEm ? `Versão ${documento.versao}, enviada em ${documento.enviadoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : `Rascunho da versão ${documento.versao}`}`,
    anotacoes: documento.anotacoes.map((a) => ({
      de: a.de,
      ate: a.ate,
      tipo: a.tipo as TipoAnotacao,
      cor: a.cor,
      texto: a.texto,
      sugestao: a.sugestao,
      decisao: a.decisao,
      autor: `${a.autor.nome} (${a.autor.tipo === "INTERNO" ? "CTP" : "Município"})`,
      criadoEm: a.createdAt,
      resolvido: a.resolvido,
      respostas: a.respostas.map((r) => ({ autor: r.autor.nome, texto: r.texto, criadoEm: r.createdAt })),
    })),
  });

  const nome = `${titulo} - v${documento.versao}`.replace(/[\\/:*?"<>|]+/g, " ").trim();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="documento.docx"; filename*=UTF-8''${encodeURIComponent(nome)}.docx`,
      "Cache-Control": "private, no-store",
    },
  });
}
