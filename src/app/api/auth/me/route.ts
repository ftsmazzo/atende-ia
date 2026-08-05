import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";

export async function GET() {
  const user = await readSession();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return NextResponse.json({ user });
}
