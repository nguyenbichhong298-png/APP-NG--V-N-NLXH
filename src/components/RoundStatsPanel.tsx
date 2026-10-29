"use client";

import { ERROR_CODE_MAP } from "@/lib/error-codes";
import { formatScore } from "@/lib/scoring";
import type { RoundStats } from "@/lib/stats";
import { Card } from "./ui";

const pctText = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("vi-VN")}%`);

/** Thanh đo một màu (độ lớn), giá trị luôn hiển thị bằng chữ. */
function Meter({ value, max = 100, label }: { value: number | null; max?: number; label: string }) {
  const w = value == null || max === 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="h-2.5 flex-1 rounded-full bg-black/5" role="img" aria-label={label}>
        <div className="h-full rounded-full bg-info" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function RoundStatsPanel({ stats }: { stats: RoundStats }) {
  const maxFreq = Math.max(1, ...stats.codeFrequency.map((c) => c.peer));
  const ref = stats.accuracy.referenceSource;
  const refLabel = ref === "teacher" ? "giáo viên" : ref === "ai" ? "AI (giáo viên chưa chấm)" : ref === "mixed" ? "giáo viên/AI" : "—";
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Tỉ lệ hoàn thành phiếu" value={pctText(stats.completion.reviewRate)} sub={`${stats.completion.reviewsSubmitted}/${stats.completion.assignments} phiếu`} />
        <Tile label="Người viết đã phản hồi" value={pctText(stats.completion.responseRate)} sub={`${stats.completion.responsesSubmitted} phản hồi`} />
        <Tile label="Độ bao phủ lỗi (so với tham chiếu)" value={pctText(stats.accuracy.recall)} sub={`${stats.accuracy.compared} phiếu được đối chiếu`} />
        <Tile label="Tỉ lệ lỗi được khắc phục" value={pctText(stats.revision.fixRate)} sub={`${stats.revision.errorsFixed}/${stats.revision.errorsBefore} lỗi · ${stats.revision.pairs} bài sửa`} />
      </div>

      <Card>
        <h3 className="font-semibold">Tần suất từng mã lỗi trong phiếu đồng đẳng</h3>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-1.5">Mã</th>
              <th>Tên</th>
              <th className="w-1/3">Số phiếu ghi nhận</th>
              <th className="text-right">Ghi nhận</th>
              <th className="text-right">Là lỗi chính</th>
            </tr>
          </thead>
          <tbody>
            {stats.codeFrequency.map((c) => (
              <tr key={c.code} className="border-b border-line/60">
                <td className="py-1.5 font-mono font-semibold">{c.code}</td>
                <td>{c.name}</td>
                <td className="pr-3">
                  <Meter value={c.peer} max={maxFreq} label={`${c.code}: ${c.peer} phiếu`} />
                </td>
                <td className="text-right">{c.peer}</td>
                <td className="text-right">{c.primary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h3 className="font-semibold">Mức độ chính xác của đánh giá đồng đẳng</h3>
        <p className="text-xs text-muted">Đối chiếu với bản chấm của {refLabel}. Độ chính xác mã lỗi (precision): {pctText(stats.accuracy.precision)}.</p>
        {stats.accuracy.compared === 0 ? (
          <p className="mt-2 text-sm text-muted">Chưa có phiếu nào có bản chấm tham chiếu. Hãy chấm đối chiếu ở bảng theo dõi.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1.5">Tiêu chí</th>
                <th className="text-right">Số phiếu</th>
                <th className="text-right">Trùng mức</th>
                <th className="text-right">Trùng điểm</th>
                <th className="text-right">Lệch điểm TB</th>
              </tr>
            </thead>
            <tbody>
              {stats.accuracy.perCriterion.map((p) => (
                <tr key={p.criterionId} className="border-b border-line/60">
                  <td className="py-1.5">{p.name}</td>
                  <td className="text-right">{p.compared}</td>
                  <td className="text-right">{pctText(p.levelAgreement)}</td>
                  <td className="text-right">{pctText(p.scoreAgreement)}</td>
                  <td className="text-right">{p.meanAbsDiff == null ? "—" : formatScore(p.meanAbsDiff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <CodeList title="Lỗi học sinh nhận diện đúng" items={stats.detectedErrors} tone="text-ok" />
          <CodeList title="Lỗi học sinh chưa nhận diện" items={stats.missedErrors} tone="text-warn" />
          <CodeList title="Mã lỗi gán thừa" items={stats.extraErrors} tone="text-muted" />
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold">Thay đổi điểm theo tiêu chí sau khi viết lại</h3>
        {stats.revision.pairs === 0 ? (
          <p className="mt-2 text-sm text-muted">Chưa có cặp bài gốc – bản sửa nào được chấm cả hai phiên bản.</p>
        ) : (
          <>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-1.5">Tiêu chí</th>
                  <th className="text-right">Điểm TB trước</th>
                  <th className="text-right">Điểm TB sau</th>
                  <th className="text-right">Thay đổi</th>
                </tr>
              </thead>
              <tbody>
                {stats.revision.scoreChange.map((c) => (
                  <tr key={c.criterionId} className="border-b border-line/60">
                    <td className="py-1.5">{c.name}</td>
                    <td className="text-right">{formatScore(c.before)}</td>
                    <td className="text-right">{formatScore(c.after)}</td>
                    <td className="text-right font-semibold">
                      {c.before != null && c.after != null ? formatScore(Math.round((c.after - c.before) * 100) / 100) : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5">Tổng</td>
                  <td className="text-right">{formatScore(stats.revision.totalBefore)}</td>
                  <td className="text-right">{formatScore(stats.revision.totalAfter)}</td>
                  <td className="text-right">
                    {stats.revision.totalBefore != null && stats.revision.totalAfter != null
                      ? formatScore(Math.round((stats.revision.totalAfter - stats.revision.totalBefore) * 100) / 100)
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
            {stats.revision.byCode.length > 0 && (
              <p className="mt-3 text-sm">
                Khắc phục theo mã:{" "}
                {stats.revision.byCode.map((b) => `${b.code} ${b.fixed}/${b.before}`).join(" · ")}
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function CodeList({ title, items, tone }: { title: string; items: { code: string; count: number }[]; tone: string }) {
  return (
    <div>
      <p className={`text-sm font-semibold ${tone}`}>{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted">—</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-sm">
          {items.map((i) => (
            <li key={i.code}>
              <span className="font-mono">{i.code}</span> {ERROR_CODE_MAP[i.code]?.shortName} · {i.count}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
