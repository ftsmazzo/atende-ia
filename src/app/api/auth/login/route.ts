import { NextResponse } from "next/server";
import { findUserByEmail, setSessionCookie, signSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; senha?: string };
  if (!body.email || !body.senha) {
    return NextResponse.json({ error: "Informe e-mail e senha" }, { status: 400 });
  }

  const user = await findUserByEmail(body.email);
  if (!user || !user.ativo) {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  const ok = await verifyPassword(body.senha, user.senha_hash);
  if (!ok) {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  const session = {
    id: user.id,
    nome: user.nome,
    email: user.email,
    papel: user.papel,
  };
  const token = await signSession(session);
  await setSessionCookie(token);
  return NextResponse.json({ user: session });
}
