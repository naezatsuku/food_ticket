export function ComingSoonPanel({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-sm font-medium text-slate-600">「{title}」は現在開発中です。</p>
      <p className="mt-1 text-xs text-slate-400">
        まずは「プロジェクト」「枠設定」「役割設定」から準備を進めてください。
      </p>
    </div>
  );
}
