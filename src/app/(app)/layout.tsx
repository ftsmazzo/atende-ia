import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { branding } from "@/lib/schema";
import { Shell } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await readSession();
  if (!user) redirect("/login");
  return (
    <Shell user={user} brand={branding.brand} appName={branding.appName}>
      {children}
    </Shell>
  );
}
