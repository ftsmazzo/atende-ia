"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Conversa = {
  telefone: string;
  nome_cliente: string | null;
  modo: string;
  operador: string | null;
  ultima: string;
  preview: string;
};

type Detalhe = {
  contato: Record<string, unknown> | null;
  atendimento: { modo: string; operador_id: number | null; operador: string | null } | null;
  mensagens: { id: number; direcao: string; texto: string; created_at: string }[];
  acoes: { id: number; cod_imovel: string; status: string | null; observacoes: string | null }[];
  operadores: { id: number; nome: string; papel: string }[];
};

function AtendimentoInner() {
  const search = useSearchParams();
  const initialTel = search.get("tel") ?? "";
  const [filtro, setFiltro] = useState("todas");
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Conversa[]>([]);
  const [tel, setTel] = useState(initialTel);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [texto, setTexto] = useState("");
  const [operadorId, setOperadorId] = useState("");
  const [erro, setErro] = useState("");

  async function loadLista() {
    const params = new URLSearchParams({ filtro, q });
    const r = await fetch(`/api/conversas?${params}`);
    const data = await r.json();
    setLista(data.conversas ?? []);
  }

  async function loadDetalhe(telefone: string) {
    const r = await fetch(`/api/conversas/${telefone}`);
    const data = await r.json();
    setDetalhe(data);
  }

  useEffect(() => {
    loadLista().catch(() => setErro("Falha ao listar conversas"));
  }, [filtro, q]);

  useEffect(() => {
    if (!tel) return;
    loadDetalhe(tel).catch(() => setErro("Falha ao abrir conversa"));
  }, [tel]);

  const modo = detalhe?.atendimento?.modo ?? "ia";

  async function action(path: string, body?: unknown) {
    setErro("");
    const r = await fetch(`/api/conversas/${tel}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json();
    if (!r.ok) {
      setErro(data.error ?? "Erro na ação");
      return;
    }
    await Promise.all([loadDetalhe(tel), loadLista()]);
  }

  async function enviar() {
    if (!texto.trim()) return;
    await action("enviar", { texto });
    setTexto("");
  }

  const titulo = useMemo(() => {
    const nome = detalhe?.contato?.nome_cliente;
    return typeof nome === "string" && nome ? nome : tel || "Selecione uma conversa";
  }, [detalhe, tel]);

  return (
    <div className="grid min-h-[72vh] overflow-hidden rounded-2xl border border-line bg-card lg:grid-cols-[320px_1fr_260px]">
      <aside className="border-b border-line lg:border-b-0 lg:border-r">
        <div className="space-y-2 border-b border-line p-3">
          <input
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            placeholder="Buscar nome ou telefone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="flex flex-wrap gap-1 text-xs">
            {[
              ["todas", "Todas"],
              ["humano", "Humanas"],
              ["ia", "Agente"],
              ["minhas", "Minhas"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFiltro(id)}
                className={`rounded-full px-2 py-1 ${filtro === id ? "bg-accent text-white" : "bg-bg"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto">
          {lista.map((item) => (
            <li key={item.telefone}>
              <button
                onClick={() => setTel(item.telefone)}
                className={`w-full border-b border-line/70 px-3 py-3 text-left ${tel === item.telefone ? "bg-accent-soft" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{item.nome_cliente || item.telefone}</strong>
                  <span className="text-[10px] uppercase text-muted">{item.modo}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted">{item.preview}</p>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-h-[50vh] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
          <div>
            <h1 className="text-lg font-semibold">{titulo}</h1>
            <p className="text-xs text-muted">{tel || "—"}</p>
          </div>
          {tel ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <button onClick={() => action("assumir")} className="rounded-lg bg-accent px-3 py-1.5 text-white">
                Assumir
              </button>
              <button onClick={() => action("devolver")} className="rounded-lg border border-line px-3 py-1.5">
                Devolver ao agente
              </button>
            </div>
          ) : null}
        </header>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {detalhe?.mensagens.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                msg.direcao === "inbound" ? "bg-bg" : msg.direcao === "outbound_ia" ? "ml-auto bg-accent-soft" : "ml-auto bg-accent text-white"
              }`}
            >
              <p>{msg.texto}</p>
              <p className={`mt-1 text-[10px] ${msg.direcao === "outbound_humano" ? "text-white/80" : "text-muted"}`}>
                {msg.direcao === "inbound" ? "Cliente" : msg.direcao === "outbound_ia" ? "Agente" : "Humano"}
              </p>
            </div>
          ))}
        </div>
        <footer className="border-t border-line p-3">
          {erro ? <p className="mb-2 text-sm text-accent">{erro}</p> : null}
          <div className="flex gap-2">
            <textarea
              className="min-h-12 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
              placeholder={modo === "humano" ? "Escreva como corretor..." : "Assuma o atendimento para responder"}
              value={texto}
              disabled={!tel || modo !== "humano"}
              onChange={(e) => setTexto(e.target.value)}
            />
            <button
              onClick={enviar}
              disabled={!tel || modo !== "humano"}
              className="rounded-lg bg-ink px-4 text-sm text-white disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        </footer>
      </section>

      <aside className="border-t border-line p-3 lg:border-l lg:border-t-0">
        <h2 className="text-sm font-medium">Transferir</h2>
        <select
          className="mt-2 w-full rounded-lg border border-line px-2 py-2 text-sm"
          value={operadorId}
          onChange={(e) => setOperadorId(e.target.value)}
        >
          <option value="">Selecionar usuário</option>
          {detalhe?.operadores.map((op) => (
            <option key={op.id} value={op.id}>
              {op.nome} ({op.papel})
            </option>
          ))}
        </select>
        <button
          className="mt-2 w-full rounded-lg border border-line py-2 text-sm"
          disabled={!tel || !operadorId}
          onClick={() => action("atribuir", { operadorId: Number(operadorId) })}
        >
          Atribuir e pausar agente
        </button>
        <h2 className="mt-6 text-sm font-medium">Lead</h2>
        <dl className="mt-2 space-y-1 text-sm">
          <div>
            <dt className="text-muted">Perfil</dt>
            <dd>{String(detalhe?.contato?.perfil_cliente ?? "—")}</dd>
          </div>
          <div>
            <dt className="text-muted">Preferência</dt>
            <dd>{String(detalhe?.contato?.preferencia_local ?? "—")}</dd>
          </div>
        </dl>
        <h2 className="mt-6 text-sm font-medium">Ações</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {(detalhe?.acoes ?? []).map((acao) => (
            <li key={acao.id} className="rounded-lg bg-bg px-2 py-2">
              <strong>{acao.cod_imovel}</strong>
              <p className="text-muted">{acao.status || "sem status"}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

export default function AtendimentoPage() {
  return (
    <Suspense fallback={<p className="text-muted">Abrindo atendimento...</p>}>
      <AtendimentoInner />
    </Suspense>
  );
}
