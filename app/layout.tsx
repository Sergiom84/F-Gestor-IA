import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme-fintech.css";
import "./tokens.css";

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
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
