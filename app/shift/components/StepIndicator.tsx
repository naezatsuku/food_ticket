"use client";

export const STEP_LABELS = [
  "プロジェクト",
  "枠設定",
  "役割設定",
  "元データ入力",
  "自動生成",
  "編集",
  "出力",
] as const;

export function StepIndicator({
  step,
  onSelect,
}: {
  step: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-xs">
      {STEP_LABELS.map((label, i) => {
        const active = i === step;
        return (
          <li key={label}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  active ? "bg-white/20" : "bg-black/10"
                }`}
              >
                {i + 1}
              </span>
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
