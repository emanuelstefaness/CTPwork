import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { camposDoFormulario } from "@/lib/campos-formulario";
import { conduzEtapa } from "@/lib/conduzir-etapa";
import { perfilEfetivoId } from "@/lib/permissoes";

/** Monta o FormData como o editor de formulários envia (uma entrada por campo, na ordem). */
function editor(campos: { chave?: string; label: string; tipo?: string; obrigatorio?: boolean }[]) {
  const dados = new FormData();
  campos.forEach((c, i) => {
    dados.append("campoChave", c.chave ?? "");
    dados.append("campoLabel", c.label);
    dados.append("campoTipo", c.tipo ?? "text");
    if (c.obrigatorio) dados.append("campoObrigatorio", String(i));
  });
  return dados;
}

describe("campos dos formulários", () => {
  it("campo novo ganha a chave a partir do rótulo, sem acento", () => {
    const [campo] = camposDoFormulario(editor([{ label: "Data da reunião", tipo: "date", obrigatorio: true }]));
    assert.deepEqual(campo, { chave: "data_da_reuniao", label: "Data da reunião", tipo: "date", obrigatorio: true });
  });

  it("renomear um campo mantém a chave em que as respostas estão", () => {
    const [campo] = camposDoFormulario(editor([{ chave: "data_uso", label: "Dia de uso do carro" }]));
    assert.equal(campo.chave, "data_uso");
  });

  it("campo novo com o mesmo nome de um existente não toma a chave dele", () => {
    const campos = camposDoFormulario(editor([{ label: "Data uso" }, { chave: "data_uso", label: "Data de uso" }]));
    assert.deepEqual(campos.map((c) => c.chave), ["data_uso_2", "data_uso"]);
  });

  it("tipo desconhecido vira texto curto e linhas sem rótulo são ignoradas", () => {
    const campos = camposDoFormulario(editor([{ label: "Motivo", tipo: "<script>" }, { label: "   " }]));
    assert.deepEqual(campos, [{ chave: "motivo", label: "Motivo", tipo: "text", obrigatorio: false }]);
  });

  it("formulário sem nenhum campo é recusado", () => {
    assert.throws(() => camposDoFormulario(editor([{ label: "" }])), /ao menos um campo/);
  });
});

describe("quem conduz a etapa de projeto", () => {
  const gestor = { perfilId: "perfil-gestor" };
  const colaborador = { perfilId: "perfil-colaborador" };
  const conduzir = ["projeto.gerenciar"];

  it("etapa sem restrição: qualquer pessoa que conduz etapas", () => {
    assert.equal(conduzEtapa(colaborador, conduzir, { perfisQueConduzem: "[]" }), true);
  });

  it("etapa reservada: só os perfis marcados", () => {
    const etapa = { perfisQueConduzem: JSON.stringify(["perfil-gestor"]) };
    assert.equal(conduzEtapa(gestor, conduzir, etapa), true);
    assert.equal(conduzEtapa(colaborador, conduzir, etapa), false);
  });

  it("sem a permissão de conduzir etapas, o perfil marcado não basta", () => {
    assert.equal(conduzEtapa(gestor, ["minuta.escrever"], { perfisQueConduzem: JSON.stringify(["perfil-gestor"]) }), false);
  });
});

describe("perfil que vale para a pessoa", () => {
  const perfis = [
    { id: "perfil-gestor", tipo: "INTERNO" },
    { id: "perfil-colaborador", tipo: "INTERNO" },
    { id: "perfil-municipio", tipo: "EXTERNO" },
    { id: "perfil-juridico", tipo: "INTERNO" },
  ];

  it("usa o perfil gravado quando ele é do tipo da pessoa", () => {
    assert.equal(perfilEfetivoId({ tipo: "INTERNO", perfilInterno: "COLABORADOR", perfilId: "perfil-juridico" }, perfis), "perfil-juridico");
  });

  it("sem perfil gravado (ou de outro tipo), cai no de fábrica — e entra na contagem dele", () => {
    assert.equal(perfilEfetivoId({ tipo: "INTERNO", perfilInterno: "COLABORADOR", perfilId: null }, perfis), "perfil-colaborador");
    assert.equal(perfilEfetivoId({ tipo: "INTERNO", perfilInterno: "GESTOR", perfilId: "perfil-municipio" }, perfis), "perfil-gestor");
    assert.equal(perfilEfetivoId({ tipo: "EXTERNO", perfilId: null }, perfis), "perfil-municipio");
  });
});
