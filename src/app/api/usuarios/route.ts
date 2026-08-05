import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isResponse, requireUser } from "@/lib/api";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.papel !== "admin") {
    return NextResponse.json({ error: "Somente admin" }, { status: 403 });
  }
  const usuarios = await query(
    `SELECT id, nome, email, papel, ativo, created_at FROM usuarios_painel ORDER BY nome`,
  );
  return NextResponse.json({ usuarios });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.papel !== "admin") {
    return NextResponse.json({ error: "Somente admin" }, { status: 403 });
  }

  const body = (await request.json()) as {
    nome?: string;
    email?: string;
    senha?: string;
    papel?: "admin" | "corretor";
  };
  if (!body.nome || !body.email || !body.senha) {
    return NextResponse.json({ error: "Nome, e-mail e senha são obrigatórios" }, { status: 400 });
  }

  const senhaHash = await hashPassword(body.senha);
  const [created] = await query(
    `INSERT INTO usuarios_painel (nome, email, senha_hash, papel)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nome, email, papel, ativo`,
    [body.nome, body.email.toLowerCase(), senhaHash, body.papel === "admin" ? "admin" : "corretor"],
  );
  return NextResponse.json({ usuario: created });
}
