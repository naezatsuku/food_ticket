import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "シフト作成 | 食券メーカー",
  description: "時間枠と役割の要件をもとにシフト表を自動作成するツール",
};

export default function ShiftLayout({ children }: { children: React.ReactNode }) {
  return children;
}
