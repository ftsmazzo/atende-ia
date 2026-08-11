import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { tables } from "@/lib/schema";

export function isAdmin(user: SessionUser) {
  return user.papel === "admin";
}

/** Corretor só acessa conversas atribuídas a ele; admin vê tudo. */
export async function assertConversaAccess(
  user: SessionUser,
  telefone: string,
): Promise<true | NextResponse> {
  if (isAdmin(user)) return true;

  const [row] = await query<{ operador_id: number | null; modo: string }>(
    `SELECT operador_id, modo FROM ${tables.attendances} WHERE telefone = $1`,
    [telefone],
  );

  if (!row || row.operador_id !== user.id) {
    return NextResponse.json(
      { error: "Conversa não atribuída a você" },
      { status: 403 },
    );
  }
  return true;
}
