import { redirect } from "next/navigation";
import { Suspense } from "react";
import { readSession } from "@/lib/auth";
import { AtendimentoClient } from "./ui";

export default async function AtendimentoPage() {
  const user = await readSession();
  if (!user) redirect("/login");

  return (
    <Suspense fallback={<p className="p-4 text-muted">Abrindo atendimento...</p>}>
      <div className="flex min-h-0 flex-1 flex-col">
        <AtendimentoClient papel={user.papel} />
      </div>
    </Suspense>
  );
}
