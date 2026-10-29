"use client";

import { codesForCriterion } from "@/lib/error-codes";
import type { CriterionId } from "@/lib/rubric";
import { cx } from "./ui";

/**
 * Tích chọn mã lỗi của một tiêu chí. Khi chọn, hiển thị tên lỗi, giải thích,
 * dấu hiệu nhận biết và gợi ý khắc phục. Cho phép đánh dấu một lỗi là lỗi chính.
 */
export function DiagnosticErrorSelector({
  criterionId,
  selected,
  onChange,
  primary,
  onPrimary,
  disabled,
  invalid,
}: {
  criterionId: CriterionId;
  selected: string[];
  onChange: (codes: string[]) => void;
  primary: string | null;
  onPrimary: (code: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const codes = codesForCriterion(criterionId);
  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
      if (primary === code) onPrimary(null);
    } else onChange([...selected, code]);
  };
  return (
    <div className={cx("space-y-2", invalid && "rounded-lg ring-2 ring-accent/50")}>
      <div className="flex flex-wrap gap-2">
        {codes.map((e) => {
          const on = selected.includes(e.code);
          return (
            <label
              key={e.code}
              className={cx(
                "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                on ? "border-accent bg-accent-soft" : "border-line bg-surface",
                disabled && "cursor-not-allowed opacity-70",
              )}
            >
              <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(e.code)} className="accent-[var(--accent)]" />
              <span className="font-mono font-semibold">{e.code}</span>
              <span className="text-muted">({e.shortName})</span>
            </label>
          );
        })}
      </div>
      {codes
        .filter((e) => selected.includes(e.code))
        .map((e) => (
          <div key={e.code} className="rounded-lg border border-line bg-paper p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                <span className="font-mono text-accent">{e.code}</span> – {e.name}
              </p>
              <label className="inline-flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="primary-error"
                  checked={primary === e.code}
                  disabled={disabled}
                  onChange={() => onPrimary(e.code)}
                  className="accent-[var(--accent)]"
                />
                Lỗi chính
              </label>
            </div>
            <p className="mt-1">{e.explanation}</p>
            <p className="mt-1.5 font-semibold text-muted">Dấu hiệu nhận biết:</p>
            <ul className="list-disc pl-4 text-muted">
              {e.signs.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="mt-1.5">
              <span className="font-semibold text-ok">Gợi ý khắc phục: </span>
              {e.fix}
            </p>
          </div>
        ))}
    </div>
  );
}
