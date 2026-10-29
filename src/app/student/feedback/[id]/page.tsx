"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AIGradingReport } from "@/components/AIGradingReport";
import { EssayRevisionEditor } from "@/components/EssayRevisionEditor";
import { WriterResponseForm } from "@/components/WriterResponseForm";
import { Alert, Badge, Button, Card, Loading, PageHeader, Steps } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { ERROR_CODE_MAP } from "@/lib/error-codes";
import { LEVEL_NAMES, RUBRIC_2026 } from "@/lib/rubric";
import { formatScore } from "@/lib/scoring";
import type { AIGrading, Assignment, EssayVersion, PeerReview, WriterResponse } from "@/lib/types";

interface Data {
  assignment: Assignment;
  round: { id: string; title: string; ai_visible: boolean; status: string };
  prompt: { id: string; title: string; content: string; issue_statement: string };
  writer_name: string;
  reviewer_name: string;
  original: EssayVersion | null;
  review: PeerReview;
  response: WriterResponse | null;
  revision: EssayVersion | null;
  ai: AIGrading | null;
  ai_revision: AIGrading | null;
}

export default function FeedbackPage() {
  return <AppShell role="student" wide>{(me) => <Inner userId={me.user.id} />}</AppShell>;
}

function Inner({ userId }: { userId: string }) {
  const { id } = useParams<{ id: string }>();
  const q = useApi<Data>(`/api/feedback/${id}`);
  const [editing, setEditing] = useState(false);
  const [showAI, setShowAI] = useState(false);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <Alert tone="error">{q.error.message}</Alert>;
  const d = q.data!;
  const r = d.review;
  const responded = d.response?.status === "submitted";
  const revisedFinal = d.revision?.status === "final";

  return (
    <>
      <Steps current={5} />
      <PageHeader
        step="Bước 5 · Người viết tiếp nhận và chỉnh sửa"
        title="Phiếu phản hồi từ bạn"
        subtitle={`Người đánh giá: ${d.reviewer_name} · ${d.round.title}`}
        actions={
          <>
            <Link href={`/reports/${d.assignment.id}`} className="text-sm text-info underline">
              Xem / xuất phiếu PDF
            </Link>
            <Link href="/student" className="text-sm text-info underline">
              ← Bài của tôi
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold uppercase text-muted">Bài viết ban đầu</p>
          <p className="essay-text mt-2 text-[15px]">{d.original?.content}</p>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Điểm và mã lỗi bạn ghi nhận</h2>
              <span className="rounded-lg bg-accent px-3 py-1 font-bold text-white">{formatScore(r.total)} / 2,00</span>
            </div>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {RUBRIC_2026.criteria.map((c) => {
                  const row = r.criteria.find((x) => x.criterion_id === c.id);
                  return (
                    <tr key={c.id} className="border-b border-line align-top">
                      <td className="py-2 pr-2">
                        {c.order}. {c.name}
                      </td>
                      <td className="whitespace-nowrap pr-2">
                        {formatScore(row?.score)} / {formatScore(c.maxScore)}
                        {row?.level && <span className="block text-xs text-muted">Mức {row.level} · {LEVEL_NAMES[row.level]}</span>}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {row?.error_codes.map((code) => (
                            <Badge key={code} tone={code === r.primary_error_code ? "accent" : "warn"}>
                              {code} {ERROR_CODE_MAP[code]?.shortName}
                            </Badge>
                          ))}
                        </div>
                        {row?.evidence && <q className="mt-1 block text-xs italic text-muted">{row.evidence}</q>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <Card>
            <h2 className="font-semibold">Nhận xét theo mô hình 3 bước</h2>
            <dl className="mt-2 space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-ok">1. Điểm sáng nổi bật</dt>
                <dd className="whitespace-pre-wrap">{r.highlight}</dd>
              </div>
              <div>
                <dt className="font-semibold text-accent">2. Lỗi gãy lập luận chính {r.primary_error_code && `– ${r.primary_error_code} (${ERROR_CODE_MAP[r.primary_error_code]?.name})`}</dt>
                <dd>
                  <q className="italic">{r.main_issue_evidence}</q>
                  <p className="whitespace-pre-wrap">{r.main_issue_explanation}</p>
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-info">3. Gợi ý điều chỉnh</dt>
                <dd className="whitespace-pre-wrap">{r.suggestion}</dd>
              </div>
            </dl>
          </Card>
          {d.ai ? (
            <Button variant="secondary" onClick={() => setShowAI((s) => !s)}>
              {showAI ? "Ẩn" : "Xem"} kết quả AI đối chiếu ({formatScore(d.ai.total)} / 2,00)
            </Button>
          ) : (
            d.round.ai_visible && <p className="text-xs text-muted">Kết quả AI chưa sẵn sàng (hoặc bạn cần hoàn thành phiếu đánh giá của mình trước).</p>
          )}
        </div>
      </div>

      {showAI && d.ai && (
        <div className="mt-6">
          <AIGradingReport grading={d.ai} />
        </div>
      )}

      <Card className="mt-6">
        <h2 className="mb-3 text-lg font-bold">III. PHẢN HỒI TỪ NGƯỜI VIẾT</h2>
        {responded ? (
          <Alert tone="ok" title="Đã gửi phản hồi">
            Bạn vẫn có thể cập nhật phản hồi bên dưới.
          </Alert>
        ) : null}
        <div className="mt-3">
          <WriterResponseForm assignmentId={d.assignment.id} initial={d.response} onSaved={() => q.reload()} />
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Chỉnh sửa bài viết</h2>
          {revisedFinal && d.revision && (
            <Link href={`/compare/${d.revision.id}`} className="text-sm text-info underline">
              So sánh trước – sau
            </Link>
          )}
        </div>
        <p className="text-sm text-muted">Bài gốc và bản chỉnh sửa được lưu thành hai phiên bản độc lập. Bạn chủ động lựa chọn nội dung sửa.</p>
        {!responded && <p className="mt-3 text-sm text-warn">Hoàn thành mục PHẢN HỒI TỪ NGƯỜI VIẾT trước khi chỉnh sửa.</p>}
        {responded && revisedFinal && (
          <div className="mt-3">
            <Alert tone="ok" title={`Đã nộp bản chỉnh sửa (phiên bản ${d.revision!.version_no})`} />
            <p className="essay-text mt-3 text-[15px]">{d.revision!.content}</p>
          </div>
        )}
        {responded && !revisedFinal && !editing && (
          <Button className="mt-3" onClick={() => setEditing(true)}>
            CHỈNH SỬA BÀI VIẾT
          </Button>
        )}
        {responded && !revisedFinal && editing && (
          <div className="mt-3">
            <EssayRevisionEditor
              endpoint={`/api/feedback/${d.assignment.id}/revision`}
              initialText={d.revision?.content ?? d.original?.content ?? ""}
              draftKey={`revision:${userId}:${d.assignment.id}`}
              savedAt={d.revision?.created_at}
              submitLabel="Nộp bản chỉnh sửa"
              confirmText="Nộp bản chỉnh sửa? Bài gốc vẫn được giữ nguyên."
              onSubmitted={() => {
                setEditing(false);
                void q.reload();
              }}
            />
          </div>
        )}
      </Card>
    </>
  );
}
