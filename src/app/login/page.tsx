"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@local");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState("Atendimento");
  const [appName, setAppName] = useState("Painel Agente");
  const [agentName, setAgentName] = useState("Agente");

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => {
        if (data.brand) setBrand(data.brand);
        if (data.appName) setAppName(data.appName);
        if (data.agentName) setAgentName(data.agentName);
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErro("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setErro(data.error ?? "Falha no login");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-line bg-card p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">{brand}</p>
        <h1 className="mt-2 text-2xl font-semibold">{appName}</h1>
        <p className="mt-2 text-sm text-muted">Entre para assumir conversas do {agentName}.</p>
        <label className="mt-6 block text-sm">
          E-mail
          <input
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <label className="mt-4 block text-sm">
          Senha
          <input
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            type="password"
            required
          />
        </label>
        {erro ? <p className="mt-3 text-sm text-accent">{erro}</p> : null}
        <button
          className="mt-6 w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
