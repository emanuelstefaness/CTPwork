/**
 * Catálogo de permissões dos perfis (Cadastros › Perfis). Fica no código porque cada permissão
 * corresponde a uma função do sistema; o gestor escolhe quais cada perfil tem.
 *
 * Regras fixas, que nenhum perfil muda:
 *   - um usuário da prefeitura só enxerga o próprio município;
 *   - ver projetos, contratos, conversas e o chat vale para todo usuário (dentro do seu alcance);
 *   - sempre existe ao menos uma pessoa ativa com acesso a Cadastros (não dá para se trancar fora).
 */

export type TipoPerfil = "INTERNO" | "EXTERNO";

export const PERMISSOES = {
  // ── Equipe do CTP ──
  painel: { tipo: "INTERNO", grupo: "Geral", rotulo: "Ver o dashboard", descricao: "Números, gráficos e atividades de toda a empresa." },
  "contrato.gerenciar": { tipo: "INTERNO", grupo: "Contratos", rotulo: "Gerenciar contratos", descricao: "Criar contratos, avançar etapas, abrir a coleta de assinaturas e criar o projeto." },
  "projeto.gerenciar": { tipo: "INTERNO", grupo: "Projetos", rotulo: "Gerenciar etapas de projeto", descricao: "Status e prazo das etapas, cronograma, checklist e concluir revisões." },
  "projeto.reabrir": { tipo: "INTERNO", grupo: "Projetos", rotulo: "Reabrir etapas concluídas", descricao: "Com motivo registrado na auditoria." },
  "minuta.escrever": { tipo: "INTERNO", grupo: "Minutas", rotulo: "Escrever minutas", descricao: "Editar o rascunho, importar Word, enviar versões ao município e aceitar ou recusar sugestões de redação." },
  "memorando.gerenciar": { tipo: "INTERNO", grupo: "Memorandos", rotulo: "Cancelar memorandos de outras pessoas", descricao: "Quem criou o memorando sempre pode cancelá-lo." },
  cadastros: { tipo: "INTERNO", grupo: "Administração", rotulo: "Acessar Cadastros", descricao: "Usuários, perfis, municípios, setores, modelos de formulário e fluxos." },
  // ── Prefeitura ──
  "minuta.revisar": { tipo: "EXTERNO", grupo: "Minutas", rotulo: "Revisar minutas", descricao: "Grifar, comentar, concordar, discordar e sugerir redação." },
  "minuta.parecer": { tipo: "EXTERNO", grupo: "Minutas", rotulo: "Dar o parecer da minuta", descricao: "Aprovar a versão ou pedir ajustes ao CTP." },
  "contrato.assinar": { tipo: "EXTERNO", grupo: "Contratos", rotulo: "Assinar contratos pelo município", descricao: "Ex.: só o prefeito ou quem ele designar." },
  "contrato.aprovar": { tipo: "EXTERNO", grupo: "Contratos", rotulo: "Aprovar etapas do contrato", descricao: "Ex.: aprovar o orçamento do CTP ou pedir revisão." },
  "etapa.enviar": { tipo: "EXTERNO", grupo: "Documentos", rotulo: "Enviar documentos e formulários", descricao: "Documentos pedidos nos contratos e nas etapas de projeto, e formulários." },
} as const satisfies Record<string, { tipo: TipoPerfil; grupo: string; rotulo: string; descricao: string }>;

export type Permissao = keyof typeof PERMISSOES;

export const permissoesDoTipo = (tipo: TipoPerfil) =>
  (Object.keys(PERMISSOES) as Permissao[]).filter((p) => PERMISSOES[p].tipo === tipo);

/** Perfis de fábrica (criados pela migração) — também são o padrão de quem ainda não tem perfil. */
export const PERFIL_GESTOR = "perfil-gestor";
export const PERFIL_COLABORADOR = "perfil-colaborador";
export const PERFIL_MUNICIPIO = "perfil-municipio";

export function perfilPadrao(user: { tipo: string; perfilInterno?: string | null }) {
  if (user.tipo === "EXTERNO") return PERFIL_MUNICIPIO;
  return user.perfilInterno === "GESTOR" ? PERFIL_GESTOR : PERFIL_COLABORADOR;
}

/** Lê a lista de permissões gravada no perfil, ignorando chaves que não valem para o tipo. */
export function lerPermissoes(json: string | null | undefined, tipo: string): Permissao[] {
  let lista: unknown = [];
  try {
    lista = JSON.parse(json ?? "[]");
  } catch {
    lista = [];
  }
  if (!Array.isArray(lista)) return [];
  return lista.filter((p): p is Permissao => typeof p === "string" && p in PERMISSOES && PERMISSOES[p as Permissao].tipo === tipo);
}

/** Lista de ids de perfis gravada em JSON (ex.: quem pode avançar uma etapa de contrato). */
export function lerIds(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export type Acesso = { perfilId: string; perfilNome: string; permissoes: Permissao[]; somenteParticipa: boolean };

export const pode = (user: { permissoes: readonly string[] }, p: Permissao) => user.permissoes.includes(p);
