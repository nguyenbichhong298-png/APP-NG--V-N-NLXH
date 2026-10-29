"use client";

import type { ButtonHTMLAttributes, ReactNode, TextareaHTMLAttributes, InputHTMLAttributes } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const styles: Record<Variant, string> = {
    primary: "bg-accent text-white hover:bg-[#7f1b2b] disabled:bg-[#c99aa2]",
    secondary: "bg-surface text-ink border border-line hover:bg-paper disabled:text-muted",
    ghost: "text-ink hover:bg-black/5 disabled:text-muted",
    danger: "bg-surface text-accent border border-accent/40 hover:bg-accent-soft",
  };
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed",
        styles[variant],
        className,
      )}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-xl border border-line bg-surface p-5 shadow-sm", className)}>{children}</section>;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "accent" | "info"; children: ReactNode }) {
  const t = {
    neutral: "bg-black/5 text-muted",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    accent: "bg-accent-soft text-accent",
    info: "bg-info-soft text-info",
  }[tone];
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", t)}>{children}</span>;
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warn" | "error" | "ok"; title?: string; children?: ReactNode }) {
  const t = {
    info: "border-info/30 bg-info-soft text-info",
    warn: "border-warn/30 bg-warn-soft text-warn",
    error: "border-accent/30 bg-accent-soft text-accent",
    ok: "border-ok/30 bg-ok-soft text-ok",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-lg border px-4 py-3 text-sm", t)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children, required }: { label: string; hint?: string; error?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      <div className="mt-1.5">{children}</div>
      {error && <span className="mt-1 block text-xs font-medium text-accent">{error}</span>}
    </label>
  );
}

export function Textarea({ invalid, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30 disabled:bg-paper",
        invalid ? "border-accent" : "border-line",
        className,
      )}
    />
  );
}

export function Input({ invalid, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30 disabled:bg-paper",
        invalid ? "border-accent" : "border-line",
        className,
      )}
    />
  );
}

export function Loading({ label = "Đang tải…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-transparent" />
      {label}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, step }: { title: string; subtitle?: ReactNode; actions?: ReactNode; step?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {step && <p className="text-xs font-semibold uppercase tracking-wider text-accent">{step}</p>}
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Steps({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  const steps = ["Tìm hiểu rubric", "Đọc bài của bạn", "Chấm & chẩn đoán", "Phản hồi 3 bước", "Tiếp nhận & sửa"];
  return (
    <ol className="no-print mb-6 grid grid-cols-5 gap-1 text-[11px] sm:text-xs">
      {steps.map((s, i) => (
        <li
          key={s}
          className={cx(
            "rounded-md border px-2 py-1.5 text-center",
            i + 1 === current ? "border-accent bg-accent text-white" : i + 1 < current ? "border-ok/30 bg-ok-soft text-ok" : "border-line text-muted",
          )}
        >
          <span className="font-semibold">B{i + 1}.</span> <span className="hidden sm:inline">{s}</span>
        </li>
      ))}
    </ol>
  );
}
