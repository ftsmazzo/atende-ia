import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { query } from "./db";

const COOKIE = "agente_session";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET ausente");
  return new TextEncoder().encode(value);
}

export type SessionUser = {
  id: number;
  nome: string;
  email: string;
  papel: "admin" | "corretor";
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function signSession(user: SessionUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: Number(payload.id),
      nome: String(payload.nome),
      email: String(payload.email),
      papel: payload.papel === "admin" ? "admin" : "corretor",
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function findUserByEmail(email: string) {
  const rows = await query<{
    id: number;
    nome: string;
    email: string;
    senha_hash: string;
    papel: "admin" | "corretor";
    ativo: boolean;
  }>(
    `SELECT id, nome, email, senha_hash, papel, ativo
     FROM usuarios_painel
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}
