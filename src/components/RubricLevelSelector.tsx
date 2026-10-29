"use client";

import { LEVEL_NAMES, renderDescription, type Level, type RubricCriterion } from "@/lib/rubric";
import { formatScore } from "@/lib/scoring";
import { cx } from "./ui";

/** Chọn Mức 4/3/2/1 cho một tiêu chí; điểm hiển thị đúng theo rubric. */
export function RubricLevelSelector({
  criterion,
  issue,
  value,
  onChange,
  disabled,
  invalid,
}: {
  criterion: RubricCriterion;
  issue?: string | null;
  value: Level | null;
  onChange: (l: Level) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={`Mức đạt được – ${criterion.name}`} className={cx("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", invalid && "rounded-lg ring-2 ring-accent/50")}>
      {criterion.levels.map((l) => {
        const on = value === l.level;
        return (
          <button
            key={l.level}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(l.level)}
            className={cx(
              "rounded-lg border p-3 text-left text-xs transition disabled:cursor-not-allowed",
              on ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-line bg-surface hover:border-accent/50",
            )}
          >
            <span className="flex items-center justify-between">
              <span className="font-semibold text-ink">
                Mức {l.level} · {LEVEL_NAMES[l.level]}
              </span>
              <span className={cx("rounded px-1.5 py-0.5 font-semibold", on ? "bg-accent text-white" : "bg-ink/5")}>{formatScore(l.score)} đ</span>
            </span>
            <span className="mt-1.5 block space-y-0.5 text-muted">
              {l.description.map((d, i) => (
                <span key={i} className="block">
                  {renderDescription(d, issue)}
                </span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
