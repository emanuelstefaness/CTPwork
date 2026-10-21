"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, AcessoNegadoError, type SessaoAtual } from "@/lib/tenant";
import { assertVeProjeto } from "@/lib/visibilidade";
import { capturar, ErroUsuario, type Resultado } from "@/lib/resultado";
import { registrarAuditoria } from "@/lib/audit";
import { NIVEIS_MEMBRO, gerenciaMembros, nivelValido } from "@/lib/membros-projeto";

/** Pessoas do projeto (ver src/lib/membros-projeto.ts). Devolvem { ok, erro } para o formulário. */

async function gestorDoProjeto(projetoId: string): Promise<SessaoAtual> {
  const user = await requireSession();
  if (!gerenciaMembros(user)) throw new AcessoNegadoError("Só quem gerencia contratos adiciona pessoas aos projetos.");
  await assertVeProjeto(user, projetoId);
  return user;
}

const campo = (formData: FormData, nome: string) => String(formData.get(nome) ?? "");

export async function adicionarMembroProjeto(formData: FormData): Promise<Resultado> {
  return capturar(async () => {
    const projetoId = campo(formData, "projetoId");
    const userId = campo(formData, "userId");
    const nivel = campo(formData, "nivel");
    const user = await gestorDoProjeto(projetoId);
    if (!nivelValido(nivel)) throw new ErroUsuario("Escolha se a pessoa vai ver ou editar o projeto.");

    const projeto = await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId }, select: { codigo: true, responsavelId: true } });
    // Só pessoas ativas do CTP: quem é da prefeitura já vê todos os projetos do próprio município.
    const pessoa = await prisma.user.findFirst({ where: { id: userId, tipo: "INTERNO", ativo: true }, select: { id: true, nome: true } });
    if (!pessoa) throw new ErroUsuario("Escolha uma pessoa ativa da equipe do CTP.");
    if (pessoa.id === projeto.responsavelId) throw new ErroUsuario(`${pessoa.nome} já é a responsável pelo projeto.`);
    if (await prisma.projetoMembro.findUnique({ where: { projetoId_userId: { projetoId, userId } } })) {
      throw new ErroUsuario(`${pessoa.nome} já participa deste projeto. Mude o nível na lista.`);
    }

    await prisma.projetoMembro.create({ data: { projetoId, userId, nivel, adicionadoPorId: user.id } });
    await prisma.notificacao.create({
      data: {
        userId,
        tipo: "PROJETO_PARTICIPANTE",
        mensagem: `${user.name ?? "O CTP"} adicionou você ao projeto ${projeto.codigo} para ${NIVEIS_MEMBRO[nivel].rotulo.toLowerCase()}.`,
        entidadeTipo: "Projeto",
        entidadeId: projetoId,
      },
    });
    await registrarAuditoria({ userId: user.id, acao: "ADICIONAR_PARTICIPANTE", entidadeTipo: "Projeto", entidadeId: projetoId, detalhe: `${pessoa.nome} · ${nivel}` });
    revalidatePath(`/projetos/${projetoId}`);
    return undefined;
  });
}

export async function alterarNivelMembroProjeto(formData: FormData): Promise<Resultado> {
  return capturar(async () => {
    const membro = await prisma.projetoMembro.findUnique({ where: { id: campo(formData, "membroId") }, include: { user: { select: { nome: true } } } });
    if (!membro) throw new ErroUsuario("Participante não encontrado. Recarregue a página.");
    const user = await gestorDoProjeto(membro.projetoId);
    const nivel = campo(formData, "nivel");
    if (!nivelValido(nivel)) throw new ErroUsuario("Nível inválido.");
    if (nivel === membro.nivel) return undefined;

    await prisma.projetoMembro.update({ where: { id: membro.id }, data: { nivel } });
    await registrarAuditoria({ userId: user.id, acao: "ALTERAR_PARTICIPANTE", entidadeTipo: "Projeto", entidadeId: membro.projetoId, detalhe: `${membro.user.nome} · ${nivel}` });
    revalidatePath(`/projetos/${membro.projetoId}`);
    return undefined;
  });
}

export async function removerMembroProjeto(formData: FormData): Promise<Resultado> {
  return capturar(async () => {
    const membro = await prisma.projetoMembro.findUnique({ where: { id: campo(formData, "membroId") }, include: { user: { select: { nome: true } } } });
    if (!membro) throw new ErroUsuario("Participante não encontrado. Recarregue a página.");
    const user = await gestorDoProjeto(membro.projetoId);

    await prisma.projetoMembro.delete({ where: { id: membro.id } });
    await registrarAuditoria({ userId: user.id, acao: "REMOVER_PARTICIPANTE", entidadeTipo: "Projeto", entidadeId: membro.projetoId, detalhe: membro.user.nome });
    revalidatePath(`/projetos/${membro.projetoId}`);
    return undefined;
  });
}
