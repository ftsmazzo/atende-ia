"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function InstallApp({ variant = "compact" }: { variant?: "compact" | "banner" }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [guide, setGuide] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setDone(true);
      return;
    }
    if (isIos()) {
      setIos(true);
      return;
    }
    function onPrompt(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (done) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setDone(true);
    setDeferred(null);
  }

  const buttonClass =
    variant === "banner"
      ? "w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white"
      : "rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white";

  if (deferred) {
    return (
      <button type="button" onClick={() => void install()} className={buttonClass}>
        Instalar app
      </button>
    );
  }

  if (ios) {
    return (
      <>
        <button type="button" onClick={() => setGuide(true)} className={buttonClass}>
          Instalar app
        </button>
        {guide ? (
          <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-4 sm:place-items-center">
            <div className="w-full max-w-sm rounded-2xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lg">
              <h2 className="text-base font-semibold">Instalar no iPhone</h2>
              <ol className="mt-3 space-y-2 text-sm text-muted">
                <li>1. Toque em <strong className="text-ink">Compartilhar</strong> (quadrado com seta).</li>
                <li>2. Role e toque em <strong className="text-ink">Adicionar à Tela de Início</strong>.</li>
                <li>3. Confirme. O painel abre como app.</li>
              </ol>
              <p className="mt-3 text-xs text-muted">Funciona no Safari. No Chrome do iPhone o iOS não deixa instalar num toque.</p>
              <button
                type="button"
                className="mt-4 w-full rounded-xl border border-line py-2.5 text-sm"
                onClick={() => setGuide(false)}
              >
                Entendi
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (variant === "banner") {
    return (
      <p className="text-center text-xs text-muted">
        No Android, abra este site no Chrome: menu <strong>⋮</strong> → Instalar app.
      </p>
    );
  }

  return null;
}
