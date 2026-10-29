"use client";

import { useMemo, useState } from "react";
import { RUBRIC_2026 } from "@/lib/rubric";
import { formatScore } from "@/lib/scoring";
import { diffWords } from "@/lib/text";
import type { AIGrading, EssayVersion, TeacherGrading } from "@/lib/types";
import { Badge, Card, cx } from "./ui";

type Scores = { source: string; byCriterion: Record<string, number | null>; total: number | null; codes: string[] } | null;

function fromAI(g: AIGrading | null): Scores {
  if (!g) return null;
  return {
    source: "AI",
    byCriterion: Object.fromEntries(g.result.criteria.map((c) => [c.criterion_id, c.score])),
    total: g.total,
    codes: [...new Set(g.result.errors.map((e) => e.code))],
  };
}
function fromTeacher(g: TeacherGrading | null): Scores {
  if (!g) return null;
  return {
    source: "Giáo viên",
    byCriterion: Object.fromEntries(g.criteria.map((c) => [c.criterion_id, c.score])),
    total: g.total,
    codes: [...new Set(g.criteria.flatMap((c) => c.error_codes))],
  };
}

/** So sánh bài gốc và bản chỉnh sửa: khác biệt theo từ và thay đổi điểm theo tiêu chí. */
export function RevisionComparison({
  original,
  revised,
  ai,
  teacher,
}: {
  original: EssayVersion;
  revised: EssayVersion;
  ai: { original: AIGrading | null; revised: AIGrading | null };
  teacher: { original: TeacherGrading | null; revised: TeacherGrading | null };
}) {
  const [view, setView] = useState<"diff" | "side">("diff");
  const ops = useMemo(() => diffWords(original.content, revised.content), [original.content, revised.content]);
  const added = ops.filter((o) => o.type === "add" && o.text.trim()).length;
  const removed = ops.filter((o) => o.type === "del" && o.text.trim()).length;
  const before = fromTeacher(teacher.original) ?? fromAI(ai.original);
  const after = fromTeacher(teacher.revised) ?? fromAI(ai.revised);

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge>Bản gốc (phiên bản {original.version_no}): {original.word_count} chữ</Badge>
            <Badge tone="info">Bản sửa (phiên bản {revised.version_no}): {revised.word_count} chữ</Badge>
            <Badge tone="ok">+{added} đoạn thêm</Badge>
            <Badge tone="accent">−{removed} đoạn bỏ</Badge>
          </div>
          <div className="flex rounded-lg border border-line text-sm">
            {(["diff", "side"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cx("px-3 py-1.5", view === v ? "bg-accent text-white" : "")}>
                {v === "diff" ? "Đánh dấu thay đổi" : "Hai cột"}
              </button>
            ))}
          </div>
        </div>
        {view === "diff" ? (
          <p className="essay-text text-sm">
            {ops.map((o, i) =>
              o.type === "same" ? (
                <span key={i}>{o.text}</span>
              ) : o.type === "add" ? (
                <ins key={i} className="bg-ok-soft text-ok no-underline">
                  {o.text}
                </ins>
              ) : (
                <del key={i} className="bg-accent-soft text-accent">
                  {o.text}
                </del>
              ),
            )}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">BÀI GỐC</p>
              <p className="essay-text rounded-lg bg-paper p-3 text-sm">{original.content}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">BẢN CHỈNH SỬA</p>
              <p className="essay-text rounded-lg bg-info-soft/40 p-3 text-sm">{revised.content}</p>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold">Thay đổi điểm theo tiêu chí</h3>
        {!before || !after ? (
          <p className="mt-2 text-sm text-muted">Chưa đủ dữ liệu chấm cho cả hai phiên bản (cần giáo viên chấm hoặc AI đã chấm và được công bố).</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2">Tiêu chí</th>
                <th>Bản gốc ({before.source})</th>
                <th>Bản sửa ({after.source})</th>
                <th>Thay đổi</th>
              </tr>
            </thead>
            <tbody>
              {RUBRIC_2026.criteria.map((c) => {
                const a = before.byCriterion[c.id] ?? null;
                const b = after.byCriterion[c.id] ?? null;
                const d = a != null && b != null ? Math.round((b - a) * 100) / 100 : null;
                return (
                  <tr key={c.id} className="border-b border-line">
                    <td className="py-2">
                      {c.order}. {c.name}
                    </td>
                    <td>{formatScore(a)}</td>
                    <td>{formatScore(b)}</td>
                    <td className={cx("font-semibold", d && d > 0 ? "text-ok" : d && d < 0 ? "text-accent" : "text-muted")}>
                      {d == null ? "—" : `${d > 0 ? "+" : ""}${formatScore(d)}`}
                    </td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td className="py-2">Tổng</td>
                <td>{formatScore(before.total)}</td>
                <td>{formatScore(after.total)}</td>
                <td>{before.total != null && after.total != null ? formatScore(Math.round((after.total - before.total) * 100) / 100) : "—"}</td>
              </tr>
            </tbody>
          </table>
        )}
        {before && after && (
          <div className="mt-3 text-sm">
            <p>
              <span className="font-semibold text-ok">Lỗi đã khắc phục: </span>
              {before.codes.filter((c) => !after.codes.includes(c)).join(", ") || "—"}
            </p>
            <p>
              <span className="font-semibold text-warn">Lỗi còn lại: </span>
              {before.codes.filter((c) => after.codes.includes(c)).join(", ") || "—"}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
