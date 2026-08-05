"use client";

import { FormEvent, useEffect, useState } from "react";

type UserRow = {
  id: number;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UserRow[]>([]);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<"corretor" | "admin">("corretor");

  async function load() {
    const r = await fetch("/api/usuarios");
    const data = await r.json();
    if (!r.ok) {
      setErro(data.error ?? "Sem permissão");
      return;
    }
    setUsuarios(data.usuarios);
  }

  useEffect(() => {
    load().catch(() => setErro("Falha ao carregar usuários"));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const r = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha, papel }),
    });
    const data = await r.json();
    if (!r.ok) {
      setErro(data.error ?? "Erro ao criar");
      return;
    }
    setNome("");
    setEmail("");
    setSenha("");
    await load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rounded-2xl border border-line bg-card p-4">
        <h1 className="text-xl font-semibold">Contas do painel</h1>
        {erro ? <p className="mt-2 text-sm text-accent">{erro}</p> : null}
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2 font-medium">Nome</th>
              <th className="font-medium">E-mail</th>
              <th className="font-medium">Papel</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="py-2">{u.nome}</td>
                <td>{u.email}</td>
                <td>{u.papel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-medium">Novo usuário</h2>
        <label className="mt-3 block text-sm">
          Nome
          <input className="mt-1 w-full rounded-lg border border-line px-3 py-2" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <label className="mt-3 block text-sm">
          E-mail
          <input className="mt-1 w-full rounded-lg border border-line px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="mt-3 block text-sm">
          Senha
          <input className="mt-1 w-full rounded-lg border border-line px-3 py-2" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </label>
        <label className="mt-3 block text-sm">
          Papel
          <select className="mt-1 w-full rounded-lg border border-line px-3 py-2" value={papel} onChange={(e) => setPapel(e.target.value as "admin" | "corretor")}>
            <option value="corretor">Corretor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button className="mt-4 w-full rounded-lg bg-accent py-2 text-sm text-white">Criar conta</button>
      </form>
    </div>
  );
}
