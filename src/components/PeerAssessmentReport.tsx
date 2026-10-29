"use client";

import Link from "next/link";
import { ERROR_CODE_MAP, codesForCriterion } from "@/lib/error-codes";
import { LEVEL_NAMES, RUBRIC_2026 } from "@/lib/rubric";
import { ACCEPTANCE_LABELS, PLANNED_ACTION_LABELS, type Acceptance, type PeerReview, type PlannedAction, type WriterResponse } from "@/lib/types";

const box = (on: boolean) => (on ? "[x]" : "[  ]");

function fmtDate(iso: string | null) {
  if (!iso) return ".... / .... / 2026";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} / ${String(d.getMonth() + 1).padStart(2, "0")} / ${d.getFullYear()}`;
}

/** Báo cáo đánh giá đồng đẳng theo đúng ba phần của phiếu giấy; in/xuất PDF qua trình duyệt. */
export function PeerAssessmentReport({
  writerName,
  reviewerName,
  promptTitle,
  review,
  response,
  revisedLink,
}: {
  writerName: string;
  reviewerName: string;
  promptTitle: string;
  review: PeerReview;
  response: WriterResponse | null;
  revisedLink: string | null;
}) {
  const cell = "border border-ink/70 px-2 py-1.5 align-top";
  return (
    <article className="print-page mx-auto max-w-[210mm] bg-white p-8 text-[13px] leading-snug text-black shadow-sm">
      <h1 className="text-center text-base font-bold">PHIẾU ĐÁNH GIÁ ĐỒNG ĐẲNG &amp; CHẨN ĐOÁN LỖI</h1>
      <p className="text-center italic">(Đi kèm Rubric chấm đoạn văn Nghị luận xã hội 200 chữ)</p>

      <table className="mt-4 w-full border-collapse">
        <tbody>
          <tr>
            <td className={cell}>
              Người viết: <b>{writerName}</b>
            </td>
            <td className={cell}>
              Người đánh giá: <b>{reviewerName}</b>
            </td>
          </tr>
          <tr>
            <td className={cell}>
              Đề bài / Chủ đề: <b>{promptTitle}</b>
            </td>
            <td className={cell}>Ngày đánh giá: {fmtDate(review.submitted_at)}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="mt-5 font-bold">I. BẢNG GHI ĐIỂM &amp; CHẨN ĐOÁN LỖI (Tra cứu theo Rubric số)</h2>
      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr className="bg-black/5">
            <th className={cell}>Tiêu chí đánh giá (Rubric)</th>
            <th className={cell}>Điểm tối đa</th>
            <th className={cell}>Điểm chấm</th>
            <th className={cell}>Mức đánh giá</th>
            <th className={cell}>Mã lỗi chẩn đoán ghi nhận (Nếu bị trừ điểm)</th>
          </tr>
        </thead>
        <tbody>
          {RUBRIC_2026.criteria.map((c) => {
            const row = review.criteria.find((x) => x.criterion_id === c.id);
            return (
              <tr key={c.id}>
                <td className={cell}>
                  {c.order}. {c.name}
                </td>
                <td className={`${cell} text-center`}>{c.maxScore.toFixed(2)} đ</td>
                <td className={`${cell} text-center font-semibold`}>{row?.score != null ? `${row.score.toFixed(2)} đ` : "....... đ"}</td>
                <td className={`${cell} text-center`}>{row?.level ? `Mức ${row.level} (${LEVEL_NAMES[row.level]})` : ""}</td>
                <td className={cell}>
                  {codesForCriterion(c.id).map((e) => (
                    <span key={e.code} className="mr-3 inline-block whitespace-nowrap">
                      {box(!!row?.error_codes.includes(e.code))} {e.code} ({e.shortName})
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 font-bold">
        ➔ TỔNG ĐIỂM ĐÁNH GIÁ ĐỒNG ĐẲNG: {review.total != null ? review.total.toFixed(2) : "........."} / 2.0 ĐIỂM
      </p>

      <h2 className="mt-5 font-bold">II. PHẢN HỒI LẬP LUẬN (Nhận xét theo mô hình 3 bước)</h2>
      <table className="mt-2 w-full border-collapse">
        <tbody>
          <tr>
            <td className={`${cell} w-48 font-semibold`}>
              1. Điểm sáng nổi bật
              <span className="block font-normal italic">(Ưu điểm về lập luận/ý kiến)</span>
            </td>
            <td className={`${cell} whitespace-pre-wrap`}>{review.highlight}</td>
          </tr>
          <tr>
            <td className={`${cell} font-semibold`}>
              2. Lỗi gãy lập luận chính
              <span className="block font-normal italic">(Ghi mã lỗi + Biểu hiện)</span>
            </td>
            <td className={cell}>
              <p>
                Mã lỗi chính:{" "}
                <b>{review.primary_error_code ? `${review.primary_error_code} – ${ERROR_CODE_MAP[review.primary_error_code]?.name}` : "(không)"}</b>
              </p>
              <p className="mt-1 whitespace-pre-wrap">Biểu hiện: {review.main_issue_evidence}</p>
              <p className="mt-1 whitespace-pre-wrap">{review.main_issue_explanation}</p>
            </td>
          </tr>
          <tr>
            <td className={`${cell} font-semibold`}>
              3. Gợi ý điều chỉnh
              <span className="block font-normal italic">(Đề xuất cách sửa cụ thể)</span>
            </td>
            <td className={`${cell} whitespace-pre-wrap`}>{review.suggestion}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="mt-5 font-bold">III. PHẢN HỒI TỪ NGƯỜI VIẾT (Tác giả bài viết ghi)</h2>
      <p className="mt-2">
        • Mức độ tiếp nhận góp ý:{" "}
        {(Object.keys(ACCEPTANCE_LABELS) as Acceptance[]).map((k) => (
          <span key={k} className="mr-4">
            {box(response?.acceptance === k)} {ACCEPTANCE_LABELS[k]}
          </span>
        ))}
      </p>
      <p className="mt-1">
        • Dự kiến điều chỉnh:{" "}
        {(Object.keys(PLANNED_ACTION_LABELS) as PlannedAction[]).map((k) => (
          <span key={k} className="mr-4">
            {box(!!response?.planned_actions.includes(k))} {PLANNED_ACTION_LABELS[k]}
          </span>
        ))}
      </p>
      <p className="mt-1 whitespace-pre-wrap">• Giải thích bổ sung: {response?.explanation || "……………………………………………"}</p>
      <p className="mt-1">
        • Bài viết đã sửa:{" "}
        {revisedLink ? (
          <Link href={revisedLink} className="text-info underline">
            Xem bản chỉnh sửa và so sánh phiên bản
          </Link>
        ) : (
          "(chưa có)"
        )}
      </p>
    </article>
  );
}
