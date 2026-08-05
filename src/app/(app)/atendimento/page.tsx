"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type Mensagem = {
  id: number;
  direcao: string;
  texto: string;
  created_at: string;
  id_mensagem_wa?: string | null;
  reacao?: string | null;
};

type Detalhe = {
  contato: Record<string, unknown> | null;
  atendimento: { modo: string; operador_id: number | null; operador: string | null } | null;
  mensagens: Mensagem[];
  operadores: { id: number; nome: string; papel: string }[];
};

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "👏", "👋"];
const POLL_MS = 3000;

function formatMsgTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat("pt-BR", {
    day: sameDay ? undefined : "2-digit",
    month: sameDay ? undefined : "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function emptyCrm() {
  return {
    nome_cliente: "",
    perfil_cliente: "",
    preferencia_local: "",
    compra_comalguem: "",
    tipo_renda: "",
    renda_bruta: "",
  };
}

function crmFromContato(contato: Record<string, unknown> | null | undefined) {
  const c = contato ?? {};
  return {
    nome_cliente: String(c.nome_cliente ?? ""),
    perfil_cliente: String(c.perfil_cliente ?? ""),
    preferencia_local: String(c.preferencia_local ?? ""),
    compra_comalguem: String(c.compra_comalguem ?? ""),
    tipo_renda: String(c.tipo_renda ?? ""),
    renda_bruta: c.renda_bruta == null || c.renda_bruta === "" ? "" : String(c.renda_bruta),
  };
}

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
  const [crm, setCrm] = useState(emptyCrm);
  const typingRef = useRef<number | null>(null);
  const dirtyCrm = useRef(false);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const nearBottom = useRef(true);
  const telRef = useRef(tel);
  const filtroRef = useRef(filtro);
  const qRef = useRef(q);

  telRef.current = tel;
  filtroRef.current = filtro;
  qRef.current = q;

  const loadLista = useCallback(async () => {
    const params = new URLSearchParams({ filtro: filtroRef.current, q: qRef.current });
    const r = await fetch(`/api/conversas?${params}`, { cache: "no-store" });
    const data = await r.json();
    setLista(data.conversas ?? []);
  }, []);

  const loadDetalhe = useCallback(async (telefone: string, opts?: { syncCrm?: boolean }) => {
    const r = await fetch(`/api/conversas/${telefone}`, { cache: "no-store" });
    const data = (await r.json()) as Detalhe;
    setDetalhe((prev) => {
      const prevLast = prev?.mensagens.at(-1)?.id;
      const nextLast = data.mensagens?.at(-1)?.id;
      if (prevLast !== nextLast && nearBottom.current) {
        queueMicrotask(() => {
          const el = chatRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      }
      return data;
    });
    if (opts?.syncCrm !== false && !dirtyCrm.current) {
      setCrm(crmFromContato(data.contato));
    }
  }, []);

  useEffect(() => {
    loadLista().catch(() => setErro("Falha ao listar conversas"));
  }, [filtro, q, loadLista]);

  useEffect(() => {
    dirtyCrm.current = false;
    if (!tel) {
      setDetalhe(null);
      setCrm(emptyCrm());
      return;
    }
    loadDetalhe(tel, { syncCrm: true }).catch(() => setErro("Falha ao abrir conversa"));
  }, [tel, loadDetalhe]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (document.visibilityState !== "visible") return;
      try {
        await loadLista();
        if (!cancelled && telRef.current) {
          await loadDetalhe(telRef.current, { syncCrm: false });
        }
      } catch {
        /* próximo ciclo tenta de novo */
      }
    }
    const id = window.setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadLista, loadDetalhe]);

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
    await Promise.all([loadDetalhe(tel, { syncCrm: false }), loadLista()]);
  }

  async function enviar() {
    if (!texto.trim()) return;
    await action("enviar", { texto });
    setTexto("");
  }

  function onTyping(value: string) {
    setTexto(value);
    if (!tel || modo !== "humano") return;
    if (typingRef.current) window.clearTimeout(typingRef.current);
    typingRef.current = window.setTimeout(() => {
      fetch(`/api/conversas/${tel}/digitando`, { method: "POST" }).catch(() => undefined);
    }, 400);
  }

  async function reagir(messageId: string, reaction: string, fromMe: boolean) {
    await action("reagir", { messageId, reaction, fromMe });
  }

  async function salvarCrm() {
    setErro("");
    const r = await fetch(`/api/conversas/${tel}/crm`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...crm,
        renda_bruta: crm.renda_bruta ? Number(crm.renda_bruta) : null,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      setErro(data.error ?? "Falha ao salvar CRM");
      return;
    }
    dirtyCrm.current = false;
    await loadDetalhe(tel, { syncCrm: true });
  }

  async function varrerCrm() {
    setErro("");
    const r = await fetch(`/api/conversas/${tel}/crm`, { method: "POST" });
    const data = await r.json();
    if (!r.ok) {
      setErro(data.error ?? "Falha ao varrer histórico");
      return;
    }
    dirtyCrm.current = false;
    await Promise.all([loadDetalhe(tel, { syncCrm: true }), loadLista()]);
  }

  const titulo = useMemo(() => {
    const nome = detalhe?.contato?.nome_cliente || crm.nome_cliente;
    return typeof nome === "string" && nome ? nome : tel || "Selecione uma conversa";
  }, [detalhe, tel, crm.nome_cliente]);

  return (
    <div className="grid min-h-[72vh] overflow-hidden rounded-2xl border border-line bg-card lg:grid-cols-[320px_1fr_280px]">
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
                  <span className="text-[10px] text-muted">{formatMsgTime(item.ultima)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted">{item.preview}</p>
                  <span className="shrink-0 text-[10px] uppercase text-muted">{item.modo}</span>
                </div>
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
        <div
          ref={chatRef}
          className="flex-1 space-y-2 overflow-y-auto p-4"
          onScroll={(e) => {
            const el = e.currentTarget;
            nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {detalhe?.mensagens.map((msg) => (
            <div
              key={msg.id}
              className={`group relative max-w-[80%] rounded-2xl px-3 pb-5 pt-2 text-sm ${
                msg.direcao === "inbound"
                  ? "bg-bg"
                  : msg.direcao === "outbound_ia"
                    ? "ml-auto bg-accent-soft"
                    : "ml-auto bg-accent text-white"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.texto}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className={`text-[10px] ${msg.direcao === "outbound_humano" ? "text-white/80" : "text-muted"}`}>
                  {msg.direcao === "inbound" ? "Cliente" : msg.direcao === "outbound_ia" ? "Agente" : "Humano"}
                  {msg.reacao ? ` · ${msg.reacao}` : ""}
                </p>
                {msg.id_mensagem_wa ? (
                  <div className="hidden gap-1 group-hover:flex">
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        className="rounded bg-white/80 px-1 text-xs"
                        onClick={() => reagir(msg.id_mensagem_wa!, emoji, msg.direcao !== "inbound")}
                        title="Reagir"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <span
                className={`absolute bottom-1.5 right-2 text-[10px] tabular-nums ${
                  msg.direcao === "outbound_humano" ? "text-white/70" : "text-muted"
                }`}
              >
                {formatMsgTime(msg.created_at)}
              </span>
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
              onChange={(e) => onTyping(e.target.value)}
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
        <h2 className="mt-6 text-sm font-medium">Lead / CRM</h2>
        <div className="mt-2 space-y-2 text-sm">
          {[
            ["nome_cliente", "Nome"],
            ["perfil_cliente", "Perfil"],
            ["preferencia_local", "Preferência"],
            ["compra_comalguem", "Compra com alguém"],
            ["tipo_renda", "Tipo de renda"],
            ["renda_bruta", "Renda bruta"],
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs text-muted">{label}</span>
              <input
                className="mt-1 w-full rounded-lg border border-line px-2 py-1.5"
                value={crm[key as keyof typeof crm]}
                disabled={!tel}
                onChange={(e) => {
                  dirtyCrm.current = true;
                  setCrm((prev) => ({ ...prev, [key]: e.target.value }));
                }}
              />
            </label>
          ))}
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg bg-ink py-2 text-white disabled:opacity-40"
              disabled={!tel}
              onClick={salvarCrm}
            >
              Salvar
            </button>
            <button
              className="flex-1 rounded-lg border border-line py-2 disabled:opacity-40"
              disabled={!tel}
              onClick={varrerCrm}
            >
              Atualizar CRM
            </button>
          </div>
        </div>
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
