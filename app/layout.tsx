import type { Metadata } from "next";
import { Geist, Golos_Text, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Marca Tekton. Self-hosted vía next/font, igual que Geist arriba: los archivos de fuente
// quedan servidos desde 'self', así el CSP (next.config.ts) no necesita abrir font-src a
// Google Fonts.
const golosText = Golos_Text({
  variable: "--font-golos-text",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Solo para énfasis puntual dentro de la pestaña Tekton (ej. el título) — no reemplaza a
// Golos Text como tipografía general, por eso no toca --font-sans ni --font-tk-sans.
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["600"],
});

export const metadata: Metadata = {
  title: "Panel de Triggers — Tekton",
  description: "Corré los workflows de n8n de Tekton sin entrar a la UI de n8n.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `geistSans.variable` NO es opcional: define --font-geist-sans, que globals.css mapea a
  // --font-sans. Sin esta clase, `font-sans` cae al fallback del sistema sin error de build
  // ni warning en consola — solo tipografía distinta que puede pasar desapercibida.
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${golosText.variable} ${playfairDisplay.variable}`}
    >
      <body className="min-h-screen bg-white font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
