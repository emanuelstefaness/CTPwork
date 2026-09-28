"use server";

import { capturar, type Resultado } from "@/lib/resultado";
import { assinarMemorando, cancelarMemorando, concluirMemorando, criarMemorando, iniciarExecucaoMemorando } from "./memorandos";
import { assinarContrato, avancarEtapaContrato, criarContrato, criarProjetoDoContrato, iniciarAssinaturaContrato } from "./contratos";
import {
  aprovarItemChecklist, avancarStatusEtapa, concluirEtapaComRevisao, criarItemChecklist, definirPrazoEtapa,
  enviarArquivoChecklist, enviarMensagemChat, reabrirEtapa, responderFormularioEtapa,
} from "./etapas";
import { criarEventoCronograma, removerEventoCronograma } from "./cronograma";
import {
  alterarAcessoUsuario, alternarFluxoContrato, atualizarPerfil, criarPerfil, excluirPerfil, atualizarEtapaFluxoContrato, atualizarFluxoContrato, criarEtapaFluxoContrato,
  criarFluxoContrato, moverEtapaFluxoContrato, removerEtapaFluxoContrato, atualizarEtapaModelo, atualizarModeloFormulario, atualizarMunicipio, atualizarUsuario, criarEtapaModelo,
  criarModeloFormulario, criarMunicipio, criarSetor, criarTipoProjeto, criarUsuario, renomearSetor, renomearTipoProjeto,
} from "./cadastros";

/**
 * Versões das actions usadas por formulários com mensagem de erro na tela. Mesma regra de negócio,
 * mas a validação volta como `{ ok: false, erro }` — em produção uma exceção lançada chegaria ao
 * navegador só como "Minified React error", sem a mensagem (ver src/lib/resultado.ts).
 */

type R = Promise<Resultado<unknown>>;

export async function criarMemorandoSeguro(formData: FormData): R {
  return capturar(() => criarMemorando(formData));
}

export async function iniciarAssinaturaContratoSeguro(formData: FormData): R {
  return capturar(() => iniciarAssinaturaContrato(formData));
}

export async function avancarEtapaContratoSeguro(contratoId: string): R {
  return capturar(() => avancarEtapaContrato(contratoId));
}

export async function criarUsuarioSeguro(formData: FormData): R {
  return capturar(() => criarUsuario(formData));
}

export async function atualizarUsuarioSeguro(formData: FormData): R {
  return capturar(() => atualizarUsuario(formData));
}

export async function criarModeloFormularioSeguro(formData: FormData): R {
  return capturar(() => criarModeloFormulario(formData));
}

export async function atualizarModeloFormularioSeguro(formData: FormData): R {
  return capturar(() => atualizarModeloFormulario(formData));
}

export async function criarEtapaModeloSeguro(formData: FormData): R {
  return capturar(() => criarEtapaModelo(formData));
}

export async function atualizarEtapaModeloSeguro(formData: FormData): R {
  return capturar(() => atualizarEtapaModelo(formData));
}

const campo = (formData: FormData, nome: string) => String(formData.get(nome) ?? "");

/* ── Contrato ── */

export async function criarContratoSeguro(formData: FormData): R {
  return capturar(() => criarContrato(formData));
}

export async function criarProjetoDoContratoSeguro(formData: FormData): R {
  return capturar(() => criarProjetoDoContrato(formData));
}

export async function assinarContratoSeguro(formData: FormData): R {
  return capturar(() => assinarContrato(campo(formData, "contratoId")));
}

/* ── Etapa do projeto ── */

export async function enviarMensagemChatSeguro(formData: FormData): R {
  return capturar(() => enviarMensagemChat(formData));
}

export async function avancarStatusEtapaSeguro(formData: FormData): R {
  return capturar(() => avancarStatusEtapa(campo(formData, "etapaId"), campo(formData, "status")));
}

export async function definirPrazoEtapaSeguro(formData: FormData): R {
  return capturar(() => definirPrazoEtapa(formData));
}

export async function reabrirEtapaSeguro(formData: FormData): R {
  return capturar(() => reabrirEtapa(formData));
}

export async function concluirEtapaComRevisaoSeguro(formData: FormData): R {
  return capturar(() => concluirEtapaComRevisao(campo(formData, "etapaId")));
}

export async function responderFormularioEtapaSeguro(formData: FormData): R {
  return capturar(() => responderFormularioEtapa(formData));
}

export async function criarItemChecklistSeguro(formData: FormData): R {
  return capturar(() => criarItemChecklist(formData));
}

export async function enviarArquivoChecklistSeguro(formData: FormData): R {
  return capturar(() => enviarArquivoChecklist(formData));
}

export async function aprovarItemChecklistSeguro(formData: FormData): R {
  return capturar(() => aprovarItemChecklist(campo(formData, "itemId")));
}

export async function criarEventoCronogramaSeguro(formData: FormData): R {
  return capturar(() => criarEventoCronograma(formData));
}

export async function removerEventoCronogramaSeguro(formData: FormData): R {
  return capturar(() => removerEventoCronograma(campo(formData, "eventoId")));
}

/* ── Memorando ── */

export async function iniciarExecucaoMemorandoSeguro(formData: FormData): R {
  return capturar(() => iniciarExecucaoMemorando(campo(formData, "memorandoId")));
}

export async function concluirMemorandoSeguro(formData: FormData): R {
  return capturar(() => concluirMemorando(campo(formData, "memorandoId")));
}

export async function cancelarMemorandoSeguro(formData: FormData): R {
  return capturar(() => cancelarMemorando(campo(formData, "memorandoId")));
}

export async function assinarMemorandoSeguro(formData: FormData): R {
  return capturar(() => assinarMemorando(campo(formData, "memorandoId")));
}

/* ── Cadastros ── */

export async function criarSetorSeguro(formData: FormData): R {
  return capturar(() => criarSetor(formData));
}

export async function renomearSetorSeguro(formData: FormData): R {
  return capturar(() => renomearSetor(formData));
}

export async function criarMunicipioSeguro(formData: FormData): R {
  return capturar(() => criarMunicipio(formData));
}

export async function atualizarMunicipioSeguro(formData: FormData): R {
  return capturar(() => atualizarMunicipio(formData));
}

export async function criarTipoProjetoSeguro(formData: FormData): R {
  return capturar(() => criarTipoProjeto(formData));
}

export async function renomearTipoProjetoSeguro(formData: FormData): R {
  return capturar(() => renomearTipoProjeto(formData));
}

/* ── Perfis ── */

export async function criarPerfilSeguro(formData: FormData): R {
  return capturar(() => criarPerfil(formData));
}

export async function atualizarPerfilSeguro(formData: FormData): R {
  return capturar(() => atualizarPerfil(formData));
}

export async function excluirPerfilSeguro(formData: FormData): R {
  return capturar(() => excluirPerfil(campo(formData, "perfilId")));
}

/* ── Fluxos de contrato ── */

export async function criarFluxoContratoSeguro(formData: FormData): R {
  return capturar(() => criarFluxoContrato(formData));
}

export async function atualizarFluxoContratoSeguro(formData: FormData): R {
  return capturar(() => atualizarFluxoContrato(formData));
}

export async function alternarFluxoContratoSeguro(formData: FormData): R {
  return capturar(() => alternarFluxoContrato(campo(formData, "fluxoId"), campo(formData, "ativo") === "true"));
}

export async function criarEtapaFluxoContratoSeguro(formData: FormData): R {
  return capturar(() => criarEtapaFluxoContrato(formData));
}

export async function atualizarEtapaFluxoContratoSeguro(formData: FormData): R {
  return capturar(() => atualizarEtapaFluxoContrato(formData));
}

export async function removerEtapaFluxoContratoSeguro(formData: FormData): R {
  return capturar(() => removerEtapaFluxoContrato(campo(formData, "etapaId")));
}

export async function moverEtapaFluxoContratoSeguro(formData: FormData): R {
  return capturar(() => moverEtapaFluxoContrato(campo(formData, "etapaId"), campo(formData, "direcao") === "up" ? "up" : "down"));
}

export async function alterarAcessoUsuarioSeguro(formData: FormData): R {
  return capturar(() => alterarAcessoUsuario(campo(formData, "usuarioId"), campo(formData, "ativo") === "true"));
}
