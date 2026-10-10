import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Doto, JetBrains_Mono, Outfit } from "next/font/google";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-outfit" });
const doto = Doto({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-doto" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Algoritm CRM",
  description: "Algoritm o'quv markazi uchun CRM tizimi",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="uz"
      data-theme={theme === "auto" ? undefined : theme}
      className={`${outfit.variable} ${doto.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
