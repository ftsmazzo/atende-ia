import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { branding } from "@/lib/schema";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: branding.appName,
  description: `${branding.appName} — atendimento humano + agente`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
