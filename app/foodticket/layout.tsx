import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "食券メーカー | 学園祭・イベント用食券生成",
  description:
    "ブラウザだけで食券をデザインし、通し番号付きのPDFを生成して印刷できるツール",
};

export default function FoodTicketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
