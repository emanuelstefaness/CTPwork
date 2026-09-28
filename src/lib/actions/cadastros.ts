"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { registrarAuditoria } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { chaveDaEtapa } from "@/lib/fluxo-contrato";
import { enviarConvite, senhaInutilizavel } from "@/lib/convites";
import { lerPermissoes, permissoesDoTipo, type TipoPerfil } from "@/lib/permissoes";
import { aindaHaAdministrador, MSG_SEM_ADMINISTRADOR } from "@/lib/usuarios-permissao";

/** Cadastros de apoio (seção 5.7 do prompt mestre) — restritos a Gestor CTP. */

// ---------- Setor ----------

export async function criarSetor(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome do setor é obrigatório.");

  const existente = await prisma.setor.findUnique({ where: { nome } });
  if (existente) throw new Error(`Já existe um setor chamado "${nome}".`);

  const setor = await prisma.setor.create({ data: { nome } });
  await registrarAuditoria({ userId: user.id, acao: "CRIAR", entidadeTipo: "Setor", entidadeId: setor.id, detalhe: nome });
  revalidatePath("/cadastros");
}

export async function renomearSetor(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const setorId = String(formData.get("setorId"));
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome do setor é obrigatório.");

  await prisma.setor.update({ where: { id: setorId }, data: { nome } });
  await registrarAuditoria({ userId: user.id, acao: "RENOMEAR", entidadeTipo: "Setor", entidadeId: setorId, detalhe: nome });
  revalidatePath("/cadastros");
}

// ---------- Município ----------

/**
 * Assistente "Nova prefeitura" (Cadastros › Municípios): num passo só cria o município, os
 * usuários da prefeitura (cada um com seu perfil, recebendo convite por e-mail para criar a
 * própria senha) e, se pedido, fluxos exclusivos copiados de um fluxo existente.
 */
export async function criarPrefeitura(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 120);
  const contatoNome = String(formData.get("contatoNome") ?? "").trim() || null;
  const contatoEmail = String(formData.get("contatoEmail") ?? "").trim() || null;
  const contatoFone = String(formData.get("contatoFone") ?? "").trim() || null;
  if (!nome) throw new Error("Informe o nome da prefeitura.");
  const existentes = await prisma.municipio.findMany({ select: { nome: true } });
  if (existentes.some((m) => m.nome.trim().toLowerCase() === nome.toLowerCase())) throw new Error(`Já existe um município chamado "${nome}".`);

  // Usuários: linhas do formulário; linhas totalmente vazias são ignoradas.
  const nomes = formData.getAll("usuarioNome").map((v) => String(v).trim());
  const emails = formData.getAll("usuarioEmail").map((v) => String(v).trim().toLowerCase());
  const perfisIds = formData.getAll("usuarioPerfil").map(String);
  const usuarios = nomes
    .map((n, i) => ({ nome: n, email: emails[i] ?? "", perfilId: perfisIds[i] ?? "" }))
    .filter((u) => u.nome || u.email);
  for (const u of usuarios) {
    if (!u.nome || !u.email) throw new Error("Cada usuário precisa de nome e e-mail.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) throw new Error(`E-mail inválido: ${u.email}`);
  }
  if (new Set(usuarios.map((u) => u.email)).size !== usuarios.length) throw new Error("Há e-mails repetidos na lista de usuários.");
  const jaCadastrados = await prisma.user.findMany({ where: { email: { in: usuarios.map((u) => u.email) } }, select: { email: true } });
  if (jaCadastrados.length) throw new Error(`Já existe usuário com o e-mail ${jaCadastrados.map((u) => u.email).join(", ")}.`);
  const perfisValidos = new Set((await prisma.perfil.findMany({ where: { tipo: "EXTERNO" }, select: { id: true } })).map((p) => p.id));
  if (usuarios.some((u) => !perfisValidos.has(u.perfilId))) throw new Error("Escolha o perfil de cada usuário da prefeitura.");

  // Fluxos exclusivos (opcionais), copiados de um existente para ajustar depois.
  const nomeCurto = nome.replace(/^Prefeitura (Municipal )?de /i, "");
  const baseContrato = String(formData.get("fluxoContratoBase") ?? "");
  const baseProjeto = String(formData.get("fluxoProjetoBase") ?? "");
  const fluxoBase = baseContrato ? await prisma.fluxoContrato.findUnique({ where: { id: baseContrato }, include: { etapas: true } }) : null;
  const tipoBase = baseProjeto ? await prisma.tipoProjetoModelo.findUnique({ where: { id: baseProjeto }, include: { etapas: true } }) : null;
  const nomeFluxo = fluxoBase ? `${fluxoBase.nome} — ${nomeCurto}` : "";
  if (fluxoBase && (await prisma.fluxoContrato.findUnique({ where: { nome: nomeFluxo } }))) throw new Error(`Já existe um tipo de contrato "${nomeFluxo}".`);
  let chaveProjeto = "";
  if (tipoBase) {
    const base = slugificarChave(`${tipoBase.nome} ${nomeCurto}`) || "PROJETO";
    chaveProjeto = base;
    for (let n = 2; await prisma.tipoProjetoModelo.findUnique({ where: { chave: chaveProjeto } }); n++) chaveProjeto = `${base}_${n}`;
  }

  const hashes = await Promise.all(usuarios.map(() => senhaInutilizavel()));
  const municipio = await prisma.$transaction(async (tx) => {
    const m = await tx.municipio.create({ data: { nome, contatoNome, contatoEmail, contatoFone } });
    for (const [i, u] of usuarios.entries()) {
      await tx.user.create({ data: { nome: u.nome, email: u.email, passwordHash: hashes[i], tipo: "EXTERNO", municipioId: m.id, perfilId: u.perfilId, convitePendente: true } });
    }
    if (fluxoBase) {
      await tx.fluxoContrato.create({
        data: {
          nome: nomeFluxo,
          descricao: `Tipo de contrato exclusivo da ${nome}.`,
          municipioId: m.id,
          etapas: { create: fluxoBase.etapas.map(({ ordem, chave, nome, curto, exigeAssinaturas, liberaProjeto, perfisQueAvancam }) => ({ ordem, chave, nome, curto, exigeAssinaturas, liberaProjeto, perfisQueAvancam })) },
        },
      });
    }
    if (tipoBase) {
      await tx.tipoProjetoModelo.create({
        data: {
          nome: `${tipoBase.nome} — ${nomeCurto}`,
          chave: chaveProjeto,
          municipioId: m.id,
          etapas: {
            create: tipoBase.etapas.map(({ ordem, nome, temInformacoesProjeto, temFormulario, temChecklist, temRevisao, modoRevisao }) => ({ ordem, nome, temInformacoesProjeto, temFormulario, temChecklist, temRevisao, modoRevisao })),
          },
        },
      });
    }
    return m;
  });

  // Convites depois de gravar: se um e-mail falhar, o cadastro já existe e dá para reenviar.
  const criados = await prisma.user.findMany({ where: { municipioId: municipio.id }, select: { id: true } });
  for (const u of criados) await enviarConvite(u.id, user.name ?? "A equipe do CTP");

  await registrarAuditoria({
    userId: user.id,
    acao: "CRIAR_PREFEITURA",
    entidadeTipo: "Municipio",
    entidadeId: municipio.id,
    detalhe: `${nome} · ${usuarios.length} usuário(s)${fluxoBase ? ` · contrato: ${nomeFluxo}` : ""}${tipoBase ? ` · projeto: ${tipoBase.nome} — ${nomeCurto}` : ""}`,
  });
  revalidatePath("/cadastros");
  redirect(`/cadastros?aba=municipios&nova=${municipio.id}`);
}

export async function criarMunicipio(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const nome = String(formData.get("nome") ?? "").trim();
  const contatoNome = String(formData.get("contatoNome") ?? "").trim() || null;
  const contatoEmail = String(formData.get("contatoEmail") ?? "").trim() || null;
  const contatoFone = String(formData.get("contatoFone") ?? "").trim() || null;
  if (!nome) throw new Error("Nome do município é obrigatório.");

  const municipio = await prisma.municipio.create({ data: { nome, contatoNome, contatoEmail, contatoFone } });
  await registrarAuditoria({ userId: user.id, acao: "CRIAR", entidadeTipo: "Municipio", entidadeId: municipio.id, detalhe: nome });
  revalidatePath("/cadastros");
}

export async function atualizarMunicipio(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const municipioId = String(formData.get("municipioId"));
  const nome = String(formData.get("nome") ?? "").trim();
  const contatoNome = String(formData.get("contatoNome") ?? "").trim() || null;
  const contatoEmail = String(formData.get("contatoEmail") ?? "").trim() || null;
  const contatoFone = String(formData.get("contatoFone") ?? "").trim() || null;
  if (!nome) throw new Error("Nome do município é obrigatório.");

  await prisma.municipio.update({ where: { id: municipioId }, data: { nome, contatoNome, contatoEmail, contatoFone } });
  await registrarAuditoria({ userId: user.id, acao: "ATUALIZAR", entidadeTipo: "Municipio", entidadeId: municipioId, detalhe: nome });
  revalidatePath("/cadastros");
}

// ---------- Usuário ----------

export async function criarUsuario(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const tipo = String(formData.get("tipo"));

  if (!nome || !email) throw new Error("Nome e e-mail são obrigatórios.");
  if (!/^[^@s]+@[^@s]+.[^@s]+$/.test(email)) throw new Error("Informe um e-mail válido.");
  // Sem senha = convite por e-mail (a pessoa cria a própria senha). Com senha, vale a digitada.
  if (senha && senha.length < 8) throw new Error("A senha precisa ter ao menos 8 caracteres — ou deixe em branco para enviar um convite.");
  if (tipo !== "INTERNO" && tipo !== "EXTERNO") throw new Error("Tipo de usuário inválido.");

  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) throw new Error(`Já existe um usuário com o e-mail "${email}".`);

  const passwordHash = senha ? await bcrypt.hash(senha, 10) : await senhaInutilizavel();
  const perfil = await perfilDoFormulario(formData, tipo);
  let novoId: string;

  if (tipo === "INTERNO") {
    const setorId = String(formData.get("setorId") ?? "") || null;
    if (!setorId) throw new Error("Selecione o setor do colaborador.");

    const novo = await prisma.user.create({ data: { nome, email, passwordHash, tipo, perfilId: perfil.id, perfilInterno: perfilLegado(perfil), setorId } });
    novoId = novo.id;
    await registrarAuditoria({ userId: user.id, acao: "CRIAR", entidadeTipo: "User", entidadeId: novo.id, detalhe: `${email} · ${perfil.nome}` });
  } else {
    const municipioId = String(formData.get("municipioId") ?? "") || null;
    if (!municipioId) throw new Error("Selecione o município deste usuário externo.");

    const novo = await prisma.user.create({ data: { nome, email, passwordHash, tipo, perfilId: perfil.id, municipioId } });
    novoId = novo.id;
    await registrarAuditoria({ userId: user.id, acao: "CRIAR", entidadeTipo: "User", entidadeId: novo.id, detalhe: `${email} · ${perfil.nome}` });
  }

  if (!senha) await enviarConvite(novoId, user.name ?? "A equipe do CTP");
  revalidatePath("/cadastros");
}

/** Manda de novo o convite de primeiro acesso (o anterior deixa de valer). */
export async function reenviarConvite(usuarioId: string) {
  const user = await exigirPermissao("cadastros");
  const alvo = await prisma.user.findUnique({ where: { id: usuarioId } });
  if (!alvo) throw new Error("Usuário não encontrado.");
  if (!alvo.ativo) throw new Error("Reative o acesso antes de reenviar o convite.");
  await enviarConvite(usuarioId, user.name ?? "A equipe do CTP");
  await registrarAuditoria({ userId: user.id, acao: "REENVIAR_CONVITE", entidadeTipo: "User", entidadeId: usuarioId, detalhe: alvo.email });
  revalidatePath("/cadastros");
}

/** Perfil escolhido no formulário de usuário — tem de ser do mesmo tipo (CTP ou prefeitura). */
async function perfilDoFormulario(formData: FormData, tipo: string) {
  const perfilId = String(formData.get("perfilId") ?? "");
  const perfil = perfilId ? await prisma.perfil.findUnique({ where: { id: perfilId } }) : null;
  if (!perfil || perfil.tipo !== tipo) throw new Error(tipo === "INTERNO" ? "Escolha o perfil do colaborador." : "Escolha o perfil do usuário da prefeitura.");
  return perfil;
}

/** Campo antigo `perfilInterno`, mantido coerente para quem ainda o lê. */
const perfilLegado = (perfil: { permissoes: string }) => (lerPermissoes(perfil.permissoes, "INTERNO").includes("cadastros") ? "GESTOR" : "COLABORADOR");

export async function atualizarUsuario(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const usuarioId = String(formData.get("usuarioId"));
  const nome = String(formData.get("nome") ?? "").trim();
  const novaSenha = String(formData.get("novaSenha") ?? "");
  if (!nome) throw new Error("Nome é obrigatório.");
  if (novaSenha && novaSenha.length < 6) throw new Error("A nova senha precisa ter ao menos 6 caracteres.");

  const alvo = await prisma.user.findUniqueOrThrow({ where: { id: usuarioId } });
  const perfil = await perfilDoFormulario(formData, alvo.tipo);
  if (perfil.id !== alvo.perfilId && !(await aindaHaAdministrador({ trocarPerfil: { usuarioId, perfilId: perfil.id } }))) {
    throw new Error(MSG_SEM_ADMINISTRADOR);
  }

  const data: { nome: string; perfilId: string; perfilInterno?: string; setorId?: string; municipioId?: string; passwordHash?: string } = { nome, perfilId: perfil.id };
  if (alvo.tipo === "INTERNO") {
    data.perfilInterno = perfilLegado(perfil);
    const setorId = String(formData.get("setorId") ?? "");
    if (!setorId) throw new Error("Selecione o setor do colaborador.");
    data.setorId = setorId;
  } else {
    const municipioId = String(formData.get("municipioId") ?? "");
    if (!municipioId) throw new Error("Selecione o município deste usuário externo.");
    data.municipioId = municipioId;
  }
  if (novaSenha) data.passwordHash = await bcrypt.hash(novaSenha, 10);

  await prisma.user.update({ where: { id: usuarioId }, data });
  await registrarAuditoria({ userId: user.id, acao: "ATUALIZAR", entidadeTipo: "User", entidadeId: usuarioId, detalhe: nome });
  revalidatePath("/cadastros");
}

/**
 * Desativa (ou reativa) o acesso de um usuário. Nada é apagado: o nome continua no histórico,
 * em comentários, assinaturas e auditoria. Desativado, o usuário não entra mais, é desconectado
 * no próximo clique (ver sessaoValidaOuNula) e some das listas de escolha e dos avisos.
 */
export async function alterarAcessoUsuario(usuarioId: string, ativo: boolean) {
  const user = await exigirPermissao("cadastros");
  if (usuarioId === user.id && !ativo) throw new Error("Você não pode desativar o seu próprio acesso.");
  const alvo = await prisma.user.findUnique({ where: { id: usuarioId } });
  if (!alvo) throw new Error("Usuário não encontrado.");
  if (alvo.ativo === ativo) return;

  if (!ativo && !(await aindaHaAdministrador({ desativarUsuarioId: usuarioId }))) {
    throw new Error("Esta é a única pessoa ativa com acesso a Cadastros. Dê esse acesso a outra pessoa antes de desativá-la.");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: usuarioId }, data: { ativo, desativadoEm: ativo ? null : new Date() } }),
    // Links de "esqueci minha senha" pendentes deixam de valer.
    ...(ativo ? [] : [prisma.tokenSenha.updateMany({ where: { userId: usuarioId, usadoEm: null }, data: { usadoEm: new Date() } })]),
  ]);
  await registrarAuditoria({ userId: user.id, acao: ativo ? "REATIVAR_USUARIO" : "DESATIVAR_USUARIO", entidadeTipo: "User", entidadeId: usuarioId, detalhe: alvo.email });
  revalidatePath("/cadastros");
}

// ---------- Modelo de Formulário ----------

function montarCampos(formData: FormData) {
  const chaves = formData.getAll("campoChave").map(String);
  const labels = formData.getAll("campoLabel").map(String);
  const tipos = formData.getAll("campoTipo").map(String);
  const obrigatorios = formData.getAll("campoObrigatorio").map(String);

  const campos = chaves
    .map((chaveRaw, i) => ({
      chave: chaveRaw.trim().toLowerCase().replace(/\s+/g, "_"),
      label: (labels[i] ?? "").trim(),
      tipo: tipos[i] ?? "text",
      obrigatorio: obrigatorios.includes(String(i)),
    }))
    .filter((c) => c.chave && c.label);

  if (campos.length === 0) throw new Error("Informe ao menos um campo para o modelo.");
  return campos;
}

export async function criarModeloFormulario(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const nome = String(formData.get("nome") ?? "").trim();
  const tipo = String(formData.get("tipo"));
  if (!nome) throw new Error("Nome do modelo é obrigatório.");
  if (tipo !== "MEMORANDO" && tipo !== "CONTRATO") throw new Error("Tipo de modelo inválido.");

  const campos = montarCampos(formData);

  const modelo = await prisma.modeloFormulario.create({ data: { nome, tipo, campos: JSON.stringify(campos) } });
  await registrarAuditoria({ userId: user.id, acao: "CRIAR", entidadeTipo: "ModeloFormulario", entidadeId: modelo.id, detalhe: nome });
  revalidatePath("/cadastros");
}

export async function atualizarModeloFormulario(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const modeloId = String(formData.get("modeloId"));
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome do modelo é obrigatório.");

  const campos = montarCampos(formData);

  await prisma.modeloFormulario.update({ where: { id: modeloId }, data: { nome, campos: JSON.stringify(campos) } });
  await registrarAuditoria({ userId: user.id, acao: "ATUALIZAR", entidadeTipo: "ModeloFormulario", entidadeId: modeloId, detalhe: nome });
  revalidatePath("/cadastros");
}

/**
 * "Disponível para" de um fluxo (de contrato ou de projeto): vazio = todas as prefeituras;
 * um município = exclusivo dele (só aparece ao criar contratos/projetos daquela prefeitura).
 */
async function municipioDoFormulario(formData: FormData): Promise<string | null> {
  const id = String(formData.get("municipioId") ?? "");
  if (!id) return null;
  if (!(await prisma.municipio.findUnique({ where: { id }, select: { id: true } }))) throw new Error("Município não encontrado.");
  return id;
}

// ---------- Perfis (cargos) e permissões ----------

export async function criarPerfil(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 60);
  const tipo = String(formData.get("tipo")) as TipoPerfil;
  const baseId = String(formData.get("baseId") ?? "");
  if (!nome) throw new Error("Dê um nome ao perfil (ex.: Jurídico, Prefeito).");
  if (tipo !== "INTERNO" && tipo !== "EXTERNO") throw new Error("Escolha se o perfil é da equipe do CTP ou da prefeitura.");
  if (await prisma.perfil.findUnique({ where: { nome } })) throw new Error(`Já existe um perfil chamado "${nome}".`);

  // Pode começar como cópia de outro perfil do mesmo tipo.
  const base = baseId ? await prisma.perfil.findUnique({ where: { id: baseId } }) : null;
  if (base && base.tipo !== tipo) throw new Error("O perfil copiado precisa ser do mesmo tipo.");
  const perfil = await prisma.perfil.create({
    data: { nome, tipo, permissoes: base?.permissoes ?? "[]", somenteParticipa: base?.somenteParticipa ?? false },
  });
  await registrarAuditoria({ userId: user.id, acao: "CRIAR", entidadeTipo: "Perfil", entidadeId: perfil.id, detalhe: nome });
  revalidatePath("/cadastros");
  redirect(`/cadastros?aba=perfis&perfil=${perfil.id}`);
}

export async function atualizarPerfil(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const perfilId = String(formData.get("perfilId"));
  const perfil = await prisma.perfil.findUniqueOrThrow({ where: { id: perfilId } });
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 60);
  const descricao = String(formData.get("descricao") ?? "").trim().slice(0, 200) || null;
  if (!nome) throw new Error("Dê um nome ao perfil.");
  const mesmoNome = await prisma.perfil.findUnique({ where: { nome } });
  if (mesmoNome && mesmoNome.id !== perfilId) throw new Error(`Já existe um perfil chamado "${nome}".`);

  const validas = permissoesDoTipo(perfil.tipo as TipoPerfil);
  const permissoes = formData.getAll("permissao").map(String).filter((p) => (validas as string[]).includes(p));
  if (!(await aindaHaAdministrador({ editarPerfil: { perfilId, permissoes } }))) throw new Error(MSG_SEM_ADMINISTRADOR);

  await prisma.perfil.update({
    where: { id: perfilId },
    data: {
      nome,
      descricao,
      permissoes: JSON.stringify(permissoes),
      somenteParticipa: perfil.tipo === "INTERNO" && formData.get("somenteParticipa") === "on",
    },
  });
  // Mantém coerente o campo antigo `perfilInterno` de quem usa este perfil.
  if (perfil.tipo === "INTERNO") {
    await prisma.user.updateMany({ where: { perfilId }, data: { perfilInterno: permissoes.includes("cadastros") ? "GESTOR" : "COLABORADOR" } });
  }
  await registrarAuditoria({ userId: user.id, acao: "ATUALIZAR", entidadeTipo: "Perfil", entidadeId: perfilId, detalhe: `${nome}: ${permissoes.join(", ") || "nenhuma permissão"}` });
  revalidatePath("/", "layout");
}

export async function excluirPerfil(perfilId: string) {
  const user = await exigirPermissao("cadastros");
  const perfil = await prisma.perfil.findUniqueOrThrow({ where: { id: perfilId }, include: { _count: { select: { usuarios: true } } } });
  if (perfil.sistema) throw new Error("Perfis de fábrica podem ser editados, mas não excluídos.");
  if (perfil._count.usuarios > 0) throw new Error(`Há ${perfil._count.usuarios} usuário(s) com este perfil. Mude o perfil deles antes de excluir.`);
  await prisma.perfil.delete({ where: { id: perfilId } });
  await registrarAuditoria({ userId: user.id, acao: "REMOVER", entidadeTipo: "Perfil", entidadeId: perfilId, detalhe: perfil.nome });
  revalidatePath("/cadastros");
  redirect("/cadastros?aba=perfis");
}

// ---------- Fluxos de contrato (tipos de contrato + etapas configuráveis) ----------
// Como nos fluxos de projeto: editar um tipo só vale para contratos criados depois — os que já
// existem têm a própria cópia das etapas (EtapaContrato). Tipos não são apagados, só desativados,
// porque há contratos ligados a eles.

async function lerEtapaContrato(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 120);
  const curto = String(formData.get("curto") ?? "").trim().slice(0, 24) || nome.slice(0, 24);
  // Quem pode concluir a etapa: só perfis do CTP que existem; nenhum marcado = quem gerencia contratos.
  const marcados = formData.getAll("perfisQueAvancam").map(String);
  const validos = marcados.length ? await prisma.perfil.findMany({ where: { id: { in: marcados }, tipo: "INTERNO" }, select: { id: true } }) : [];
  return {
    nome,
    curto,
    exigeAssinaturas: formData.get("exigeAssinaturas") === "on",
    liberaProjeto: formData.get("liberaProjeto") === "on",
    perfisQueAvancam: JSON.stringify(validos.map((p) => p.id)),
  };
}

async function validarAssinaturaUnica(fluxoId: string, exigeAssinaturas: boolean, ignorarEtapaId?: string) {
  if (!exigeAssinaturas) return;
  const outra = await prisma.etapaFluxoContrato.findFirst({ where: { fluxoId, exigeAssinaturas: true, ...(ignorarEtapaId ? { id: { not: ignorarEtapaId } } : {}) } });
  if (outra) throw new Error(`A etapa "${outra.nome}" já é a de assinaturas. Cada tipo de contrato tem uma só.`);
}

export async function criarFluxoContrato(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 80);
  const baseId = String(formData.get("baseId") ?? "");
  if (!nome) throw new Error("Dê um nome ao tipo de contrato.");
  if (await prisma.fluxoContrato.findUnique({ where: { nome } })) throw new Error(`Já existe um tipo de contrato chamado "${nome}".`);

  // Pode nascer como cópia de outro tipo (ex.: partir do Padrão e ajustar).
  const base = baseId ? await prisma.fluxoContrato.findUnique({ where: { id: baseId }, include: { etapas: { orderBy: { ordem: "asc" } } } }) : null;
  const fluxo = await prisma.fluxoContrato.create({
    data: {
      nome,
      descricao: base?.descricao ?? null,
      etapas: base ? { create: base.etapas.map(({ ordem, chave, nome, curto, exigeAssinaturas, liberaProjeto, perfisQueAvancam }) => ({ ordem, chave, nome, curto, exigeAssinaturas, liberaProjeto, perfisQueAvancam })) } : undefined,
    },
  });
  await registrarAuditoria({ userId: user.id, acao: "CRIAR", entidadeTipo: "FluxoContrato", entidadeId: fluxo.id, detalhe: base ? `${nome} (cópia de ${base.nome})` : nome });
  revalidatePath("/cadastros");
  redirect(`/cadastros?aba=fluxos-contrato&fluxo=${fluxo.id}`);
}

export async function atualizarFluxoContrato(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const fluxoId = String(formData.get("fluxoId"));
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 80);
  const descricao = String(formData.get("descricao") ?? "").trim().slice(0, 300) || null;
  if (!nome) throw new Error("Dê um nome ao tipo de contrato.");
  const mesmoNome = await prisma.fluxoContrato.findUnique({ where: { nome } });
  if (mesmoNome && mesmoNome.id !== fluxoId) throw new Error(`Já existe um tipo de contrato chamado "${nome}".`);
  const municipioId = await municipioDoFormulario(formData);
  await prisma.fluxoContrato.update({ where: { id: fluxoId }, data: { nome, descricao, municipioId } });
  await registrarAuditoria({ userId: user.id, acao: "ATUALIZAR", entidadeTipo: "FluxoContrato", entidadeId: fluxoId, detalhe: nome });
  revalidatePath("/cadastros");
}

export async function alternarFluxoContrato(fluxoId: string, ativo: boolean) {
  const user = await exigirPermissao("cadastros");
  if (!ativo) {
    const outrosUtilizaveis = await prisma.fluxoContrato.count({ where: { ativo: true, id: { not: fluxoId }, etapas: { some: { ordem: { gte: 1 } } } } });
    if (outrosUtilizaveis === 0) throw new Error("Este é o único tipo de contrato em uso. Crie ou ative outro antes de desativá-lo.");
  }
  await prisma.fluxoContrato.update({ where: { id: fluxoId }, data: { ativo } });
  await registrarAuditoria({ userId: user.id, acao: ativo ? "ATIVAR" : "DESATIVAR", entidadeTipo: "FluxoContrato", entidadeId: fluxoId });
  revalidatePath("/cadastros");
}

export async function criarEtapaFluxoContrato(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const fluxoId = String(formData.get("fluxoId"));
  const dados = await lerEtapaContrato(formData);
  if (!dados.nome) throw new Error("Nome da etapa é obrigatório.");
  await validarAssinaturaUnica(fluxoId, dados.exigeAssinaturas);

  const existentes = await prisma.etapaFluxoContrato.findMany({ where: { fluxoId }, select: { chave: true, ordem: true } });
  const base = chaveDaEtapa(dados.nome);
  let chave = base;
  for (let n = 2; existentes.some((e) => e.chave === chave); n++) chave = `${base}_${n}`;
  const ordem = existentes.reduce((m, e) => Math.max(m, e.ordem), -1) + 1;

  const etapa = await prisma.etapaFluxoContrato.create({ data: { fluxoId, ordem, chave, ...dados } });
  await registrarAuditoria({ userId: user.id, acao: "CRIAR", entidadeTipo: "EtapaFluxoContrato", entidadeId: etapa.id, detalhe: dados.nome });
  revalidatePath("/cadastros");
}

export async function atualizarEtapaFluxoContrato(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const etapaId = String(formData.get("etapaId"));
  const dados = await lerEtapaContrato(formData);
  if (!dados.nome) throw new Error("Nome da etapa é obrigatório.");
  const etapa = await prisma.etapaFluxoContrato.findUniqueOrThrow({ where: { id: etapaId } });
  await validarAssinaturaUnica(etapa.fluxoId, dados.exigeAssinaturas, etapaId);
  await prisma.etapaFluxoContrato.update({ where: { id: etapaId }, data: dados });
  await registrarAuditoria({ userId: user.id, acao: "ATUALIZAR", entidadeTipo: "EtapaFluxoContrato", entidadeId: etapaId, detalhe: dados.nome });
  revalidatePath("/cadastros");
}

export async function removerEtapaFluxoContrato(etapaId: string) {
  const user = await exigirPermissao("cadastros");
  const etapa = await prisma.etapaFluxoContrato.findUniqueOrThrow({ where: { id: etapaId } });
  await prisma.etapaFluxoContrato.delete({ where: { id: etapaId } });
  await registrarAuditoria({ userId: user.id, acao: "REMOVER", entidadeTipo: "EtapaFluxoContrato", entidadeId: etapaId, detalhe: etapa.nome });
  revalidatePath("/cadastros");
}

export async function moverEtapaFluxoContrato(etapaId: string, direcao: "up" | "down") {
  const user = await exigirPermissao("cadastros");
  const atual = await prisma.etapaFluxoContrato.findUniqueOrThrow({ where: { id: etapaId } });
  const vizinha = await prisma.etapaFluxoContrato.findFirst({
    where: { fluxoId: atual.fluxoId, ordem: direcao === "up" ? { lt: atual.ordem } : { gt: atual.ordem } },
    orderBy: { ordem: direcao === "up" ? "desc" : "asc" },
  });
  if (!vizinha) return;
  await prisma.$transaction([
    prisma.etapaFluxoContrato.update({ where: { id: atual.id }, data: { ordem: vizinha.ordem } }),
    prisma.etapaFluxoContrato.update({ where: { id: vizinha.id }, data: { ordem: atual.ordem } }),
  ]);
  await registrarAuditoria({ userId: user.id, acao: "REORDENAR", entidadeTipo: "EtapaFluxoContrato", entidadeId: etapaId });
  revalidatePath("/cadastros");
}

// ---------- Fluxos de projeto (tipos de projeto + etapas configuráveis) ----------
// Dá ao Gestor CTP autonomia para criar tipos de projeto novos (ex.: "Plano de Mobilidade") e
// montar/editar o fluxo de etapas de cada um, sem depender de alteração de código. Editar um
// modelo só afeta projetos criados DEPOIS da edição — projetos já em andamento têm suas próprias
// EtapaProjeto, gravadas de forma independente no momento da criação.

function slugificarChave(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function criarTipoProjeto(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome do tipo de projeto é obrigatório.");

  const chave = slugificarChave(nome);
  if (!chave) throw new Error("Não foi possível gerar um identificador a partir desse nome. Tente um nome com letras.");

  const existente = await prisma.tipoProjetoModelo.findUnique({ where: { chave } });
  if (existente) throw new Error(`Já existe um tipo de projeto equivalente a "${nome}". Escolha um nome diferente.`);

  const tipo = await prisma.tipoProjetoModelo.create({ data: { chave, nome } });
  await registrarAuditoria({ userId: user.id, acao: "CRIAR", entidadeTipo: "TipoProjetoModelo", entidadeId: tipo.id, detalhe: nome });
  revalidatePath("/cadastros");
  redirect(`/cadastros?aba=fluxos&fluxo=${tipo.id}`);
}

export async function renomearTipoProjeto(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const tipoId = String(formData.get("tipoId"));
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome é obrigatório.");

  const municipioId = await municipioDoFormulario(formData);
  await prisma.tipoProjetoModelo.update({ where: { id: tipoId }, data: { nome, municipioId } });
  await registrarAuditoria({ userId: user.id, acao: "RENOMEAR", entidadeTipo: "TipoProjetoModelo", entidadeId: tipoId, detalhe: nome });
  revalidatePath("/cadastros");
}

function lerCapacidadesEtapa(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    modoRevisao: String(formData.get("modoRevisao") ?? "ARTIGO"),
    temInformacoesProjeto: formData.get("temInformacoesProjeto") === "on",
    temFormulario: formData.get("temFormulario") === "on",
    temChecklist: formData.get("temChecklist") === "on",
    temRevisao: formData.get("temRevisao") === "on",
  };
}

export async function criarEtapaModelo(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const tipoProjetoModeloId = String(formData.get("tipoProjetoModeloId"));
  const dados = lerCapacidadesEtapa(formData);
  if (!dados.nome) throw new Error("Nome da etapa é obrigatório.");

  const ultima = await prisma.etapaModelo.findFirst({ where: { tipoProjetoModeloId }, orderBy: { ordem: "desc" } });
  const ordem = (ultima?.ordem ?? -1) + 1;

  const etapa = await prisma.etapaModelo.create({ data: { tipoProjetoModeloId, ordem, ...dados } });
  await registrarAuditoria({ userId: user.id, acao: "CRIAR", entidadeTipo: "EtapaModelo", entidadeId: etapa.id, detalhe: dados.nome });
  revalidatePath("/cadastros");
}

export async function atualizarEtapaModelo(formData: FormData) {
  const user = await exigirPermissao("cadastros");
  const etapaModeloId = String(formData.get("etapaModeloId"));
  const dados = lerCapacidadesEtapa(formData);
  if (!dados.nome) throw new Error("Nome da etapa é obrigatório.");

  await prisma.etapaModelo.update({ where: { id: etapaModeloId }, data: dados });
  await registrarAuditoria({ userId: user.id, acao: "ATUALIZAR", entidadeTipo: "EtapaModelo", entidadeId: etapaModeloId, detalhe: dados.nome });
  revalidatePath("/cadastros");
}

export async function removerEtapaModelo(etapaModeloId: string) {
  const user = await exigirPermissao("cadastros");
  const etapa = await prisma.etapaModelo.findUniqueOrThrow({ where: { id: etapaModeloId } });

  await prisma.etapaModelo.delete({ where: { id: etapaModeloId } });
  await registrarAuditoria({ userId: user.id, acao: "REMOVER", entidadeTipo: "EtapaModelo", entidadeId: etapaModeloId, detalhe: etapa.nome });
  revalidatePath("/cadastros");
}

export async function moverEtapaModelo(etapaModeloId: string, direcao: "up" | "down") {
  const user = await exigirPermissao("cadastros");
  const atual = await prisma.etapaModelo.findUniqueOrThrow({ where: { id: etapaModeloId } });
  const vizinha = await prisma.etapaModelo.findFirst({
    where: {
      tipoProjetoModeloId: atual.tipoProjetoModeloId,
      ordem: direcao === "up" ? { lt: atual.ordem } : { gt: atual.ordem },
    },
    orderBy: { ordem: direcao === "up" ? "desc" : "asc" },
  });
  if (!vizinha) return;

  await prisma.$transaction([
    prisma.etapaModelo.update({ where: { id: atual.id }, data: { ordem: vizinha.ordem } }),
    prisma.etapaModelo.update({ where: { id: vizinha.id }, data: { ordem: atual.ordem } }),
  ]);
  await registrarAuditoria({ userId: user.id, acao: "REORDENAR", entidadeTipo: "EtapaModelo", entidadeId: etapaModeloId });
  revalidatePath("/cadastros");
}
