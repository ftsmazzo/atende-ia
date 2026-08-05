"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/atendimento", label: "Atendimento" },
  { href: "/usuarios", label: "Usuários" },
];

export function Shell({
  children,
  user,
  brand,
  appName,
}: {
  children: React.ReactNode;
  user: { nome: string; papel: string };
  brand: string;
  appName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{brand}</p>
            <strong className="text-lg">{appName}</strong>
          </div>
          <nav className="flex gap-1">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 text-sm ${active ? "bg-accent text-white" : "text-muted hover:bg-bg"}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">
              {user.nome} · {user.papel}
            </span>
            <button onClick={logout} className="rounded-full border border-line px-3 py-1 hover:bg-bg">
              Sair
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </div>
  );
}
