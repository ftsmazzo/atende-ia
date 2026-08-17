"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { InstallApp } from "@/components/InstallApp";

const links = [
  { href: "/dashboard", label: "Painel" },
  { href: "/atendimento", label: "Conversas" },
  { href: "/usuarios", label: "Equipe" },
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
  const chat = pathname.startsWith("/atendimento");

  useEffect(() => {
    const viewport = window.visualViewport;
    function apply() {
      const height = viewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${height}px`);
    }
    apply();
    viewport?.addEventListener("resize", apply);
    viewport?.addEventListener("scroll", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      viewport?.removeEventListener("resize", apply);
      viewport?.removeEventListener("scroll", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className={`flex flex-col ${chat ? "h-[var(--app-height,100dvh)] overflow-hidden" : "min-h-dvh"}`}>
      <header
        className={`sticky top-0 z-20 shrink-0 border-b border-line bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm ${
          chat ? "hidden lg:block" : ""
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-[0.16em] text-muted sm:text-[11px]">{brand}</p>
            <strong className="block truncate text-sm sm:text-lg">{appName}</strong>
          </div>
          <nav className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-0.5 overflow-x-auto sm:ml-0 sm:flex-none sm:justify-center">
            {links
              .filter((link) => user.papel === "admin" || link.href !== "/usuarios")
              .map((link) => {
                const active = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`shrink-0 rounded-full px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm ${
                      active ? "bg-accent text-white" : "text-muted hover:bg-bg"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
          </nav>
          <div className="flex items-center gap-2">
            <InstallApp />
            <span className="hidden max-w-[10rem] truncate text-xs text-muted sm:inline">{user.nome}</span>
            <button onClick={logout} className="rounded-full border border-line px-3 py-1 text-xs hover:bg-bg">
              Sair
            </button>
          </div>
        </div>
      </header>
      <div
        className={`mx-auto flex min-h-0 w-full flex-1 flex-col ${
          chat ? "max-w-none p-0" : "max-w-7xl px-3 py-4 sm:px-4 sm:py-6"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
