import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "学園祭ツール | 食券メーカー・シフト作成",
  description: "学園祭・イベント運営向けの食券メーカーとシフト作成ツール",
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
