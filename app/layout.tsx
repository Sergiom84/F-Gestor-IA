import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme-fintech.css";
import "./tokens.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap"
});

export const metadata: Metadata = {
  title: "GFiscal",
  description: "Bandeja fiscal y documental para gestorias, pymes y autonomos."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={plusJakartaSans.variable}>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
