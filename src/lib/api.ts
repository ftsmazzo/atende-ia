import { NextResponse } from "next/server";
import { readSession, type SessionUser } from "./auth";

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  return user;
}

export function isResponse(value: SessionUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
