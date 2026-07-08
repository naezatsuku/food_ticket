"use client";

import { useEffect, useState, type ReactNode } from "react";

/** 設定パネルの1セクション */
export function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="bg-white rounded-lg border border-slate-200 shadow-sm open:pb-4"
    >
      <summary className="cursor-pointer select-none px-4 py-3 font-bold text-sm text-slate-700">
        {title}
      </summary>
      <div className="px-4 space-y-3">{children}</div>
    </details>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400";

/**
 * 数値入力。入力途中の空文字を許容しつつ、確定した数値のみ onChange で通知する。
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    // 外部から値が変わったら表示も追従(入力途中の同値は上書きしない)
    setText((prev) => (Number(prev) === value ? prev : String(value)));
  }, [value]);
  return (
    <input
      type="number"
      className={className ?? inputClass}
      value={text}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => {
        const s = e.target.value;
        setText(s);
        const n = Number(s);
        if (s !== "" && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

export function Button({
  onClick,
  children,
  variant = "default",
  disabled,
  title,
}: {
  onClick?: () => void;
  children: ReactNode;
  variant?: "default" | "primary" | "danger" | "ghost";
  disabled?: boolean;
  title?: string;
}) {
  const styles = {
    default:
      "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50",
    primary: "bg-blue-600 text-white hover:bg-blue-700 border border-blue-600",
    danger: "bg-white border border-red-300 text-red-600 hover:bg-red-50",
    ghost: "text-slate-500 hover:bg-slate-100 border border-transparent",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles}`}
    >
      {children}
    </button>
  );
}

/** エラーメッセージ表示 */
export function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded border border-red-300 bg-red-50 px-3 py-2 space-y-1">
      {errors.map((e, i) => (
        <p key={i} className="text-xs text-red-700">
          {e}
        </p>
      ))}
    </div>
  );
}

/** 確認ダイアログ(モーダル) */
export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-base font-bold text-slate-800">{title}</h2>
        {children}
      </div>
    </div>
  );
}
