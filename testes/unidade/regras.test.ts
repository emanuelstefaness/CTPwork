import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estaNaoLida } from "@/lib/conversas";
import { bloqueado, limpar, registrarFalha } from "@/lib/limite-tentativas";

describe("conversa não lida", () => {
  const agora = new Date("2026-09-24T12:00:00Z");
  const antes = new Date("2026-09-24T11:00:00Z");
  const conversa = (autorTipo: string, lidoEm?: Date) => ({
    ultimaMensagemEm: agora,
    leituras: lidoEm ? [{ lidoEm }] : [],
    mensagens: [{ autor: { tipo: autorTipo } }],
  });

  it("mensagem do outro lado que a pessoa ainda não abriu é não lida", () => {
    assert.equal(estaNaoLida(conversa("EXTERNO"), { tipo: "INTERNO" }), true);
    assert.equal(estaNaoLida(conversa("EXTERNO", antes), { tipo: "INTERNO" }), true);
  });

  it("depois de abrir a conversa, deixa de ser não lida", () => {
    assert.equal(estaNaoLida(conversa("EXTERNO", agora), { tipo: "INTERNO" }), false);
  });

  it("resposta de um colega do mesmo lado não acende a conversa", () => {
    assert.equal(estaNaoLida(conversa("INTERNO"), { tipo: "INTERNO" }), false);
    assert.equal(estaNaoLida(conversa("EXTERNO"), { tipo: "EXTERNO" }), false);
  });

  it("conversa sem mensagens nunca é não lida", () => {
    assert.equal(estaNaoLida({ ultimaMensagemEm: agora, leituras: [], mensagens: [] }, { tipo: "INTERNO" }), false);
  });
});

describe("limite de tentativas", () => {
  it("bloqueia ao atingir o máximo e libera depois de limpar", () => {
    const chave = `teste-${Math.random()}`;
    for (let i = 0; i < 4; i++) registrarFalha(chave, 60_000);
    assert.equal(bloqueado(chave, 5, 60_000), 0, "4 falhas ainda não bloqueiam");
    registrarFalha(chave, 60_000);
    assert.ok(bloqueado(chave, 5, 60_000) > 0, "a 5ª falha bloqueia");
    limpar(chave);
    assert.equal(bloqueado(chave, 5, 60_000), 0);
  });

  it("a janela expira sozinha", async () => {
    const chave = `teste-${Math.random()}`;
    for (let i = 0; i < 5; i++) registrarFalha(chave, 50);
    assert.ok(bloqueado(chave, 5, 50) > 0);
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(bloqueado(chave, 5, 50), 0);
  });
});
