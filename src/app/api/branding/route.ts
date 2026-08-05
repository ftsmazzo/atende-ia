import { NextResponse } from "next/server";
import { branding } from "@/lib/schema";

export async function GET() {
  return NextResponse.json(branding);
}
