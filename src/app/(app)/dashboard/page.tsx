"use client";

import { useEffect, useState } from "react";

type Dash = {
  kpis: Record<string, string>;
  acoesPorStatus: { status: string; total: string }[];
  volume: { dia: string; total: string }[];
  recentes: {
    telefone: string;
    nome_cliente: string | null;
    modo: string;
    operador: string | null;
    ultima: string;
    preview: string;
  }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [erro, setErro] = useState("");
  const [varrendo, setVarrendo] = useState(false);
  const [varredura, setVarredura] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Erro ao carregar");
        setData(json);
      })
      .catch((e: Error) => setErro(e.message));
  }, []);

  if (erro) return <p className="text-accent">{erro}. Confira se o SQL do painel já rodou no Postgres.</p>;
  if (!data) return <p className="text-muted">Carregando indicadores...</p>;

  const cards = [
    ["Contatos", data.kpis.contatos, `+${data.kpis.contatos_7d} em 7 dias`],
    ["Ações de lead", data.kpis.acoes, `+${data.kpis.acoes_7d} em 7 dias`],
    ["Com humano", data.kpis.humanos, "Agente pausado"],
    ["Msgs / 7 dias", data.kpis.mensagens_7d, `${data.kpis.conversas_ativas_7d} conversas`],
  ];

  const maxVol = Math.max(1, ...data.volume.map((v) => Number(v.total)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tomada de decisão</h1>
          <p className="text-sm text-muted">Leads, ações e pulso do atendimento WhatsApp.</p>
        </div>
        <div className="text-right">
          <button
            disabled={varrendo}
            className="rounded-lg border border-line bg-card px-3 py-2 text-sm disabled:opacity-50"
            onClick={async () => {
              setVarrendo(true);
              setVarredura("");
              const r = await fetch("/api/crm/varrer", { method: "POST" });
              const json = await r.json();
              setVarrendo(false);
              if (!r.ok) {
                setVarredura(json.error ?? "Falha na varredura");
                return;
              }
              setVarredura(`${json.atualizados} conversas varridas do histórico`);
            }}
          >
            {varrendo ? "Varrendo CRM..." : "Varrer CRM do banco"}
          </button>
          {varredura ? <p className="mt-1 text-xs text-muted">{varredura}</p> : null}
        </div>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([title, value, hint]) => (
          <article key={title} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
            <p className="mt-1 text-sm text-muted">{hint}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-5">
        <article className="rounded-2xl border border-line bg-card p-4 lg:col-span-3">
          <h2 className="font-medium">Volume de mensagens (14 dias)</h2>
          <div className="mt-4 flex h-40 items-end gap-1">
            {data.volume.length === 0 ? (
              <p className="text-sm text-muted">Ainda sem mensagens no painel. O histórico começa após o gate no n8n.</p>
            ) : (
              data.volume.map((item) => (
                <div key={item.dia} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-accent/80"
                    style={{ height: `${(Number(item.total) / maxVol) * 100}%`, minHeight: 4 }}
                    title={`${item.dia}: ${item.total}`}
                  />
                  <span className="text-[10px] text-muted">{item.dia}</span>
                </div>
              ))
            )}
          </div>
        </article>
        <article className="rounded-2xl border border-line bg-card p-4 lg:col-span-2">
          <h2 className="font-medium">Ações por status</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.acoesPorStatus.map((row) => (
              <li key={row.status} className="flex justify-between border-b border-line/70 pb-1">
                <span>{row.status}</span>
                <strong>{row.total}</strong>
              </li>
            ))}
          </ul>
        </article>
      </section>
      <article className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-medium">Últimas conversas</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 font-medium">Contato</th>
                <th className="font-medium">Modo</th>
                <th className="font-medium">Prévia</th>
              </tr>
            </thead>
            <tbody>
              {data.recentes.map((row) => (
                <tr key={row.telefone} className="border-t border-line/80">
                  <td className="py-2">
                    <a className="text-accent underline-offset-2 hover:underline" href={`/atendimento?tel=${row.telefone}`}>
                      {row.nome_cliente || row.telefone}
                    </a>
                  </td>
                  <td>{row.modo === "humano" ? `Humano${row.operador ? ` · ${row.operador}` : ""}` : "Agente"}</td>
                  <td className="max-w-md truncate text-muted">{row.preview}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
