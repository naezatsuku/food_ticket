import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "食券メーカー | 学園祭・イベント用食券生成",
  description:
    "ブラウザだけで食券をデザインし、通し番号付きのPDFを生成して印刷できるツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-100 text-slate-900">
        {children}
      </body>
    </html>
  );
}
