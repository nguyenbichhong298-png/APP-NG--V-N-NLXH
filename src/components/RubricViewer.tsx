"use client";

import { useMemo, useState } from "react";
import { codesForCriterion, ERROR_CODES } from "@/lib/error-codes";
import { LEVEL_NAMES, LEVELS, RUBRIC_2026, renderDescription, type CriterionId, type Level } from "@/lib/rubric";
import { formatScore } from "@/lib/scoring";
import { Badge, cx, Input } from "./ui";

/** Bảng rubric tương tác: 4 tiêu chí × 4 mức, điểm giữ nguyên tài liệu gốc. */
export function RubricViewer({ issue, compact }: { issue?: string | null; compact?: boolean }) {
  const rubric = RUBRIC_2026;
  const [active, setActive] = useState<{ c: CriterionId; l: Level } | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left">
              <th className="w-56 border-b border-line p-3">Tiêu chí</th>
              {LEVELS.map((l) => (
                <th key={l} className="border-b border-l border-line p-3">
                  Mức {l} <span className="font-normal text-muted">· {LEVEL_NAMES[l]}</span>
                  <div className="text-xs font-normal text-muted">{rubric.totalBands.find((b) => b.level === l)?.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rubric.criteria.map((c) => (
              <tr key={c.id} className="align-top">
                <td className="border-b border-line p-3">
                  <p className="font-semibold">
                    {c.order}. {c.name}
                  </p>
                  <p className="mt-1 text-xs text-muted">{c.rubricGroup}</p>
                  <Badge tone="accent">Tối đa {formatScore(c.maxScore)} đ</Badge>
                </td>
                {c.levels.map((l) => {
                  const on = active?.c === c.id && active.l === l.level;
                  return (
                    <td key={l.level} className="border-b border-l border-line p-0">
                      <button
                        type="button"
                        onClick={() => setActive(on ? null : { c: c.id, l: l.level })}
                        className={cx("block h-full w-full p-3 text-left transition", on ? "bg-accent-soft" : "hover:bg-paper")}
                      >
                        <span className={cx("block space-y-1", compact && !on && "line-clamp-3")}>
                          {l.description.map((d, i) => (
                            <span key={i} className="block">
                              {renderDescription(d, issue)}
                            </span>
                          ))}
                        </span>
                        <span className="mt-2 inline-block rounded bg-ink/5 px-2 py-0.5 text-xs font-semibold">{formatScore(l.score)} điểm</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="p-3 font-semibold">Tổng điểm</td>
              <td colSpan={4} className="border-l border-line p-3 font-semibold">
                {formatScore(rubric.totalMax)} điểm
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {active && (
        <div className="rounded-xl border border-accent/30 bg-accent-soft/50 p-4 text-sm">
          <p className="font-semibold">
            Mã lỗi thường gặp khi chưa đạt mức tối đa ở tiêu chí “{rubric.criteria.find((c) => c.id === active.c)?.name}”
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {codesForCriterion(active.c).map((e) => (
              <li key={e.code} className="rounded-lg bg-surface p-3">
                <span className="font-mono font-semibold text-accent">{e.code}</span> – {e.name}
                <p className="mt-1 text-muted">{e.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={() => setShowNotes((s) => !s)} className="text-sm text-info underline-offset-2 hover:underline">
        {showNotes ? "Ẩn" : "Xem"} ghi chú đối chiếu tài liệu gốc
      </button>
      {showNotes && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Nguồn: {rubric.source}.</li>
          {rubric.criteria.flatMap((c) => c.sourceNotes.map((n, i) => <li key={`${c.id}-${i}`}>Tiêu chí {c.order}: {n}</li>))}
        </ul>
      )}
    </div>
  );
}

/** Bảng tra cứu mã lỗi: tên lỗi, biểu hiện, ví dụ minh họa. */
export function ErrorCodeTable() {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? ERROR_CODES.filter((e) => [e.code, e.name, e.shortName, e.explanation, ...e.signs].join(" ").toLowerCase().includes(s))
      : ERROR_CODES;
  }, [q]);
  return (
    <div className="space-y-3">
      <Input placeholder="Tìm mã lỗi, tên lỗi hoặc biểu hiện… (ví dụ: dẫn chứng)" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((e) => (
          <article key={e.code} className="rounded-xl border border-line bg-surface p-4 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                <span className="font-mono text-accent">{e.code}</span> · {e.shortName}
              </h3>
              <span className="text-xs text-muted">Tiêu chí {RUBRIC_2026.criteria.find((c) => c.id === e.criterionId)?.order}</span>
            </div>
            <p className="mt-1">{e.explanation}</p>
            <p className="mt-2 text-xs font-semibold text-muted">Dấu hiệu nhận biết</p>
            <ul className="list-disc pl-5 text-muted">
              {e.signs.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-semibold text-muted">Ví dụ</p>
            <p className="italic text-muted">{e.example}</p>
            <p className="mt-2 text-xs font-semibold text-ok">Hướng khắc phục</p>
            <p>{e.fix}</p>
          </article>
        ))}
        {list.length === 0 && <p className="text-sm text-muted">Không tìm thấy mã lỗi phù hợp.</p>}
      </div>
    </div>
  );
}
