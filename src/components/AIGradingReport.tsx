"use client";

import { ERROR_CODE_MAP } from "@/lib/error-codes";
import { bandForTotal, LEVEL_NAMES, RUBRIC_2026 } from "@/lib/rubric";
import { formatScore } from "@/lib/scoring";
import type { AIGrading } from "@/lib/types";
import { formatDate } from "@/lib/client/api";
import { Badge, Card } from "./ui";

/** Kết quả AI chấm độc lập theo rubric. */
export function AIGradingReport({ grading }: { grading: AIGrading }) {
  const r = grading.result;
  const band = bandForTotal(r.total);
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Kết quả AI chấm độc lập</h2>
            <p className="text-xs text-muted">
              {grading.model} · {formatDate(grading.created_at)} · Kết quả tham khảo, giáo viên là người quyết định.
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-accent">
              {formatScore(r.total)} <span className="text-base text-muted">/ {formatScore(RUBRIC_2026.totalMax)}</span>
            </p>
            {band && <p className="text-xs text-muted">Khung Mức {band.level} ({band.label})</p>}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2">Tiêu chí</th>
                <th>Mức</th>
                <th>Điểm</th>
                <th>Bằng chứng từ bài viết</th>
              </tr>
            </thead>
            <tbody>
              {RUBRIC_2026.criteria.map((c) => {
                const x = r.criteria.find((y) => y.criterion_id === c.id);
                return (
                  <tr key={c.id} className="border-b border-line align-top">
                    <td className="py-2 pr-3 font-medium">
                      {c.order}. {c.name}
                    </td>
                    <td className="pr-3">{x ? `Mức ${x.level} · ${LEVEL_NAMES[x.level]}` : "—"}</td>
                    <td className="pr-3 font-semibold">
                      {formatScore(x?.score)} / {formatScore(c.maxScore)}
                    </td>
                    <td className="py-2">
                      {x?.evidence.map((q) => (
                        <q key={q} className="mb-1 block text-muted">
                          {q}
                        </q>
                      ))}
                      <p className="text-xs">{x?.rationale}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold text-ok">Ưu điểm</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {r.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="font-semibold text-warn">Hạn chế</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {r.weaknesses.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold">Chẩn đoán lỗi theo mã</h3>
        {r.errors.length === 0 && <p className="mt-2 text-sm text-muted">AI không ghi nhận lỗi thuộc mã chẩn đoán.</p>}
        <div className="mt-3 space-y-3">
          {r.errors.map((e, i) => (
            <div key={i} className="rounded-lg border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold text-accent">{e.code}</span>
                <span className="font-medium">{ERROR_CODE_MAP[e.code]?.name}</span>
                <Badge>{e.location}</Badge>
                {e.quote_verified === false && <Badge tone="warn">Trích dẫn chưa khớp nguyên văn – cần kiểm tra</Badge>}
              </div>
              <q className="mt-2 block bg-paper px-2 py-1 italic">{e.quote}</q>
              <p className="mt-2">
                <span className="font-semibold">Lí do: </span>
                {e.reason}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-ok">Cách sửa: </span>
                {e.fix}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {r.style_suggestions.length > 0 && (
        <Card>
          <h3 className="font-semibold">Gợi ý nâng cao chất lượng diễn đạt</h3>
          <p className="text-xs text-muted">Đây không phải lỗi theo mã chẩn đoán, mà là gợi ý để bài viết hay hơn.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {r.style_suggestions.map((s, i) => (
              <li key={i} className="rounded-lg bg-info-soft/60 p-3">
                <q className="italic">{s.quote}</q>
                <p className="mt-1">→ {s.suggestion}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold">Đoạn văn tham khảo (khoảng 200 chữ)</h3>
        <p className="essay-text mt-2 text-sm">{r.reference_paragraph}</p>
      </Card>

      <Card>
        <h3 className="font-semibold">Ba đề luyện tập phù hợp</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {r.practice_prompts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
