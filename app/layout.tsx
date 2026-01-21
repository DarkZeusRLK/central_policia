import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Intranet Policial | REVOADA RJ",
  description: "Central de Polícia Oficial da Cidade Revoada RJ",
  icons: {
    icon: "/images/Logo_policia.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className={inter.className} style={{ minHeight: "100vh", backgroundColor: "#0f172a", overflowX: "hidden", margin: 0 }}>
        <Sidebar />
        {children}
      </body>
    </html>
  );
}
