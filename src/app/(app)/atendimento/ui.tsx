"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InstallApp } from "@/components/InstallApp";

type Conversa = {
  telefone: string;
  nome_cliente: string | null;
  modo: string;
  operador: string | null;
  ultima: string;
  preview: string;
};

type Mensagem = {
  id: number | string;
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

type Operador = { id: number; nome: string; papel: string };

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "👏", "👋"];
const POLL_MS = 3000;

function formatMsgTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("pt-BR", {
    day: sameDay ? undefined : "2-digit",
    month: sameDay ? undefined : "2-digit",
    year: sameDay || sameYear ? undefined : "numeric",
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

export function AtendimentoClient({ papel }: { papel: "admin" | "corretor" }) {
  const router = useRouter();
  const search = useSearchParams();
  const initialTel = search.get("tel") ?? "";
  const isAdmin = papel === "admin";
  const [filtro, setFiltro] = useState(isAdmin ? "todas" : "minhas");
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Conversa[]>([]);
  const [tel, setTel] = useState(initialTel);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [texto, setTexto] = useState("");
  const [operadorId, setOperadorId] = useState("");
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [atribuindo, setAtribuindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [crm, setCrm] = useState(emptyCrm);
  const [crmOpen, setCrmOpen] = useState(false);
  const [reactId, setReactId] = useState<string | null>(null);
  const typingRef = useRef<number | null>(null);
  const enviandoRef = useRef(false);
  const dirtyCrm = useRef(false);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const nearBottom = useRef(true);
  const telRef = useRef(tel);
  const filtroRef = useRef(filtro);
  const qRef = useRef(q);

  telRef.current = tel;
  filtroRef.current = filtro;
  qRef.current = q;

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/usuarios", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.usuarios)) {
          setOperadores(
            data.usuarios
              .filter((u: { ativo?: boolean }) => u.ativo !== false)
              .map((u: Operador) => ({ id: u.id, nome: u.nome, papel: u.papel })),
          );
        }
      })
      .catch(() => undefined);
  }, [isAdmin]);

  const loadLista = useCallback(async () => {
    const params = new URLSearchParams({ filtro: filtroRef.current, q: qRef.current });
    const r = await fetch(`/api/conversas?${params}`, { cache: "no-store" });
    const data = await r.json();
    setLista(data.conversas ?? []);
  }, []);

  const loadDetalhe = useCallback(async (telefone: string, opts?: { syncCrm?: boolean; soft?: boolean }) => {
    const r = await fetch(`/api/conversas/${telefone}`, { cache: "no-store" });
    if (!r.ok) {
      if (!opts?.soft) {
        setDetalhe(null);
        setErro("Conversa não disponível para você");
      }
      return;
    }
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
    if (data.operadores?.length) {
      setOperadores((prev) => (prev.length ? prev : data.operadores));
    }
    if (opts?.syncCrm !== false && !dirtyCrm.current) {
      setCrm(crmFromContato(data.contato));
    }
  }, []);

  useEffect(() => {
    loadLista().catch(() => setErro("Falha ao listar conversas"));
  }, [filtro, q, loadLista]);

  useEffect(() => {
    dirtyCrm.current = false;
    setOkMsg("");
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
          await loadDetalhe(telRef.current, { syncCrm: false, soft: true });
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
  const listaOperadores = operadores.length ? operadores : detalhe?.operadores ?? [];

  async function action(path: string, body?: unknown) {
    setErro("");
    setOkMsg("");
    const r = await fetch(`/api/conversas/${tel}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErro(data.error ?? "Erro na ação");
      return false;
    }
    await Promise.all([loadDetalhe(tel, { syncCrm: false, soft: true }), loadLista()]);
    return true;
  }

  async function atribuir() {
    if (!tel) {
      setErro("Selecione uma conversa");
      return;
    }
    if (!operadorId) {
      setErro("Selecione o usuário para encaminhar");
      return;
    }
    setAtribuindo(true);
    try {
      const ok = await action("atribuir", { operadorId: Number(operadorId) });
      if (ok) {
        const nome = listaOperadores.find((op) => String(op.id) === operadorId)?.nome ?? "usuário";
        setOkMsg(`Encaminhado para ${nome}. Não depende da Evolution.`);
      }
    } finally {
      setAtribuindo(false);
    }
  }

  async function enviar() {
    const payload = texto.trim();
    if (!payload || !tel || modo !== "humano") return;
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErro("");
    try {
      const ok = await action("enviar", { texto: payload });
      if (ok) setTexto("");
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
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
    if (typeof nome === "string" && nome.trim()) return nome;
    if (!tel) return "Selecione uma conversa";
    return isAdmin ? tel : "Cliente";
  }, [detalhe, tel, crm.nome_cliente, isAdmin]);

  function labelConversa(item: Conversa) {
    if (item.nome_cliente?.trim()) return item.nome_cliente;
    return isAdmin ? item.telefone : "Cliente";
  }

  const noChat = !tel;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="grid h-full min-h-0 flex-1 overflow-hidden bg-bg lg:grid-cols-[300px_minmax(0,1fr)_260px]">
      <aside
        className={`min-h-0 flex-col border-line bg-card ${
          noChat ? "flex h-full" : "hidden lg:flex"
        } lg:border-r`}
      >
        <div className="border-b border-line px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Conversas</p>
              <strong className="block truncate text-sm">Atendimento</strong>
            </div>
            <Link href="/dashboard" className="rounded-full border border-line px-2.5 py-1 text-xs">
              Painel
            </Link>
            <button type="button" onClick={() => void logout()} className="rounded-full border border-line px-2.5 py-1 text-xs">
              Sair
            </button>
          </div>
          <div className="mt-2">
            <InstallApp variant="banner" />
          </div>
        </div>
        <div className="space-y-2 border-b border-line p-3">
          <input
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            placeholder={isAdmin ? "Buscar nome ou telefone" : "Buscar nome"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="flex flex-wrap gap-1 text-xs">
            {(isAdmin
              ? [
                  ["todas", "Todas"],
                  ["humano", "Humanas"],
                  ["ia", "Agente"],
                  ["minhas", "Minhas"],
                ]
              : [["minhas", "Minhas"]]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={`rounded-full px-2 py-1 ${filtro === id ? "bg-accent text-white" : "bg-bg"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {!isAdmin ? (
            <p className="text-[11px] text-muted">Só aparecem conversas encaminhadas para você.</p>
          ) : null}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {lista.map((item) => (
            <li key={item.telefone}>
              <button
                type="button"
                onClick={() => setTel(item.telefone)}
                className={`flex w-full gap-3 border-b border-line/70 px-3 py-3 text-left ${tel === item.telefone ? "bg-accent-soft" : ""}`}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {labelConversa(item).slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <strong className="truncate text-[15px]">{labelConversa(item)}</strong>
                    <span className="shrink-0 text-[11px] text-muted">{formatMsgTime(item.ultima)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] text-muted">{item.preview}</p>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] uppercase ${
                        item.modo === "humano" ? "bg-accent text-white" : "bg-bg text-muted"
                      }`}
                    >
                      {item.modo === "humano" ? "você" : "agente"}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className={`min-h-0 flex-col bg-chat ${noChat ? "hidden lg:flex" : "flex h-full"}`}>
        <header className="flex shrink-0 items-center gap-2 border-b border-line bg-card px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-3 sm:px-3 sm:py-3 lg:pt-3">
          <button
            type="button"
            className="rounded-full px-2 py-1 text-sm text-accent lg:hidden"
            onClick={() => setTel("")}
          >
            ←
          </button>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
            {titulo.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[16px] font-semibold leading-tight">{titulo}</h1>
            <p className="truncate text-[11px] text-muted">
              {modo === "humano"
                ? detalhe?.atendimento?.operador
                  ? `Com ${detalhe.atendimento.operador}`
                  : "Atendimento humano"
                : "Agente respondendo"}
              {isAdmin && tel ? ` · ${tel}` : ""}
            </p>
          </div>
          {tel ? (
            <div className="flex shrink-0 gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setCrmOpen(true)}
                className="rounded-full border border-line px-3 py-1.5 text-xs lg:hidden"
              >
                Lead
              </button>
              {isAdmin && modo !== "humano" ? (
                <button
                  type="button"
                  onClick={() => void action("assumir")}
                  className="rounded-full bg-accent px-3 py-1.5 text-xs text-white sm:text-sm"
                >
                  Assumir
                </button>
              ) : null}
              {modo === "humano" ? (
                <button
                  type="button"
                  onClick={() => void action("devolver")}
                  className="hidden rounded-full border border-line px-3 py-1.5 text-sm lg:inline"
                >
                  Devolver
                </button>
              ) : null}
            </div>
          ) : null}
        </header>
        <div
          ref={chatRef}
          className="chat-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3 sm:px-4"
          onScroll={(e) => {
            const el = e.currentTarget;
            nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {tel && detalhe?.mensagens.length ? (
            <p className="mb-3 text-center text-[11px] text-muted">{detalhe.mensagens.length} mensagens</p>
          ) : tel ? (
            <p className="py-8 text-center text-sm text-muted">Nenhuma mensagem ainda.</p>
          ) : (
            <p className="hidden py-16 text-center text-sm text-muted lg:block">Selecione uma conversa.</p>
          )}
          {detalhe?.mensagens.map((msg) => {
            const inbound = msg.direcao === "inbound";
            const humano = msg.direcao === "outbound_humano";
            const openReact = reactId === String(msg.id);
            return (
              <div
                key={msg.id}
                className={`relative max-w-[82%] px-3 pb-4 pt-2 text-[15px] leading-snug shadow-sm ${
                  inbound
                    ? "rounded-[18px] rounded-bl-md bg-card"
                    : humano
                      ? "ml-auto rounded-[18px] rounded-br-md bg-accent text-white"
                      : "ml-auto rounded-[18px] rounded-br-md bg-[#efe6d8] text-ink"
                }`}
                onClick={() => {
                  if (!msg.id_mensagem_wa) return;
                  setReactId(openReact ? null : String(msg.id));
                }}
              >
                {msg.direcao === "outbound_ia" ? (
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">Agente</p>
                ) : null}
                <p className="whitespace-pre-wrap break-words">{msg.texto}</p>
                {msg.reacao ? <span className="mt-1 inline-block text-sm">{msg.reacao}</span> : null}
                {openReact && msg.id_mensagem_wa ? (
                  <div className="absolute -bottom-3 left-2 z-10 flex gap-0.5 rounded-full border border-line bg-card px-1 py-0.5 shadow-sm">
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="rounded-full px-1 text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReactId(null);
                          void reagir(msg.id_mensagem_wa!, emoji, !inbound);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
                <span
                  className={`absolute bottom-1.5 right-2.5 text-[10px] tabular-nums ${
                    humano ? "text-white/70" : "text-muted"
                  }`}
                >
                  {formatMsgTime(msg.created_at)}
                </span>
              </div>
            );
          })}
        </div>
        <footer className="shrink-0 border-t border-line bg-card px-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 sm:px-3 sm:pt-3">
          {erro ? <p className="mb-2 text-sm text-accent">{erro}</p> : null}
          {okMsg ? <p className="mb-2 text-sm text-muted">{okMsg}</p> : null}
          {tel && modo !== "humano" && isAdmin ? (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-accent-soft px-3 py-2">
              <p className="text-xs text-ink">O agente está respondendo neste chat.</p>
              <button
                type="button"
                onClick={() => void action("assumir")}
                className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs text-white"
              >
                Assumir
              </button>
            </div>
          ) : null}
          {tel && modo === "humano" ? (
            <button
              type="button"
              onClick={() => void action("devolver")}
              className="mb-2 text-xs text-muted underline lg:hidden"
            >
              Devolver ao agente
            </button>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              className="max-h-28 min-h-11 flex-1 resize-none rounded-[22px] border border-line bg-bg px-4 py-2.5"
              placeholder={modo === "humano" ? "Mensagem" : "Assuma para responder"}
              value={texto}
              disabled={!tel || modo !== "humano" || enviando}
              onChange={(e) => onTyping(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
            />
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={!tel || modo !== "humano" || enviando || !texto.trim()}
              className="h-11 w-11 shrink-0 rounded-full bg-accent text-sm text-white disabled:opacity-40"
            >
              {enviando ? "…" : "➤"}
            </button>
          </div>
        </footer>
      </section>

      {crmOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
          aria-label="Fechar lead"
          onClick={() => setCrmOpen(false)}
        />
      ) : null}

      <aside
        className={`z-40 min-h-0 overflow-y-auto border-line bg-card p-3 lg:static lg:block lg:border-l ${
          crmOpen
            ? "fixed inset-x-0 bottom-0 max-h-[80dvh] rounded-t-2xl border-t shadow-lg lg:max-h-none lg:rounded-none lg:shadow-none"
            : "hidden lg:block"
        }`}
      >
        <div className="mb-3 flex items-center justify-between lg:hidden">
          <h2 className="text-sm font-medium">Lead</h2>
          <button type="button" className="text-sm text-accent" onClick={() => setCrmOpen(false)}>
            Fechar
          </button>
        </div>
        {isAdmin ? (
          <>
            <h2 className="text-sm font-medium">Transferir</h2>
            <p className="mt-1 text-[11px] text-muted">
              Só grava no painel (pausa a SofIA). Não precisa da Evolution ligada.
            </p>
            <select
              className="mt-2 w-full rounded-lg border border-line px-2 py-2 text-sm"
              value={operadorId}
              onChange={(e) => {
                setOperadorId(e.target.value);
                setErro("");
              }}
            >
              <option value="">Selecionar usuário</option>
              {listaOperadores.map((op) => (
                <option key={op.id} value={String(op.id)}>
                  {op.nome} ({op.papel})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="mt-2 w-full rounded-lg bg-accent py-2 text-sm text-white disabled:opacity-40"
              disabled={!tel || atribuindo}
              onClick={() => void atribuir()}
            >
              {atribuindo ? "Atribuindo…" : "Atribuir e pausar agente"}
            </button>
          </>
        ) : (
          <p className="text-xs text-muted">
            Você atende apenas conversas encaminhadas pelo administrador.
          </p>
        )}
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
              type="button"
              className="flex-1 rounded-lg bg-ink py-2 text-white disabled:opacity-40"
              disabled={!tel}
              onClick={() => void salvarCrm()}
            >
              Salvar
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg border border-line py-2 disabled:opacity-40"
              disabled={!tel}
              onClick={() => void varrerCrm()}
            >
              Atualizar CRM
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
