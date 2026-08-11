import { redirect } from "next/navigation";
import { Suspense } from "react";
import { readSession } from "@/lib/auth";
import { AtendimentoClient } from "./ui";

export default async function AtendimentoPage() {
  const user = await readSession();
  if (!user) redirect("/login");

  return (
    <Suspense fallback={<p className="text-muted">Abrindo atendimento...</p>}>
      <AtendimentoClient papel={user.papel} />
    </Suspense>
  );
}
