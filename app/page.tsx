import Link from "next/link";

const TOOLS = [
  {
    href: "/foodticket",
    icon: "🎫",
    title: "食券メーカー",
    description: "学園祭・イベント用の食券をデザインして、通し番号付きPDFを印刷用に出力します。",
  },
  {
    href: "/shift",
    icon: "📅",
    title: "シフト作成",
    description:
      "時間枠と役割の必要人数からシフト表を自動作成します。Googleフォームの回答をスプレッドシートからコピーしてそのまま貼り付け、取り込めます。",
  },
] as const;

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">🎪 学園祭ツール</h1>
        <p className="mt-2 text-sm text-slate-500">
          使いたいツールを選んでください。データはすべてブラウザ内に保存されます。
        </p>
      </header>

      <nav className="flex flex-col gap-4">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors active:bg-slate-50 sm:hover:border-blue-300 sm:hover:shadow-md"
          >
            <span className="text-3xl leading-none">{tool.icon}</span>
            <span className="flex-1">
              <span className="block text-base font-bold text-slate-800">{tool.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                {tool.description}
              </span>
            </span>
            <span className="mt-1 text-slate-300">→</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
