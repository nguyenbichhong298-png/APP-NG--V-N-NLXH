"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AIGradingReport } from "@/components/AIGradingReport";
import { PeerReviewForm } from "@/components/PeerReviewForm";
import { RubricViewer } from "@/components/RubricViewer";
import { Alert, Badge, Button, Card, Loading, PageHeader, Steps } from "@/components/ui";
import { formatDate, useApi } from "@/lib/client/api";
import { formSignals } from "@/lib/text";
import type { AIGrading, Assignment, CriterionScore, EssayVersion, PeerReview } from "@/lib/types";

interface Data {
  assignment: Assignment;
  round: { id: string; title: string; deadline: string | null; rubric_published: boolean; ai_visible: boolean; status: string };
  prompt: { id: string; title: string; content: string; issue_statement: string };
  writer_name: string;
  reviewer_name: string;
  version: EssayVersion | null;
  review: PeerReview | null;
  ai: AIGrading | null;
  empty_criteria: CriterionScore[];
}

export default function ReviewPage() {
  return <AppShell role="student" wide>{() => <Inner />}</AppShell>;
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const q = useApi<Data>(`/api/review/${id}`);
  const [started, setStarted] = useState(false);
  const [showRubric, setShowRubric] = useState(false);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <Alert tone="error">{q.error.message}</Alert>;
  const d = q.data!;
  const submitted = d.review?.status === "submitted";
  const inForm = started || !!d.review;

  return (
    <>
      <Steps current={submitted ? 5 : inForm ? 3 : 2} />
      <PageHeader
        step={inForm ? "Bước 3–4 · Chấm theo rubric và phản hồi" : "Bước 2 · Đọc bài viết của bạn"}
        title={`Đánh giá bài của ${d.writer_name}`}
        subtitle={`${d.round.title} · Hạn nộp phiếu: ${formatDate(d.round.deadline)}`}
        actions={<Link href="/student" className="text-sm text-info underline">← Bài của tôi</Link>}
      />

      {!d.round.rubric_published && <Alert tone="warn" title="Chưa thể đánh giá">Giáo viên chưa công khai rubric cho đợt này.</Alert>}
      {!d.version && <Alert tone="info">Bạn {d.writer_name} chưa nộp bài viết. Hãy quay lại sau.</Alert>}

      {d.version && d.round.rubric_published && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Card>
              <p className="text-xs font-semibold uppercase text-muted">Đề bài</p>
              <p className="mt-1 text-sm">{d.prompt.content}</p>
            </Card>
            <Card>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase text-muted">Bài viết của bạn</p>
                <Badge>{formSignals(d.version.content).words} chữ</Badge>
              </div>
              <p className="essay-text max-h-[60vh] overflow-auto text-[15px]">{d.version.content}</p>
            </Card>
            <Alert tone="info">
              Hãy đọc kĩ bài viết của bạn, đánh giá khách quan, tôn trọng sự khác biệt trong cách diễn đạt và đưa ra góp ý có căn cứ.
            </Alert>
          </div>

          <div>
            {!inForm ? (
              <Card>
                <h2 className="font-semibold">Rubric số</h2>
                <p className="mb-3 text-sm text-muted">Xem lại rubric trước khi chấm.</p>
                <RubricViewer issue={d.prompt.issue_statement} compact />
                <Button className="mt-4 w-full" onClick={() => setStarted(true)}>
                  Bắt đầu đánh giá
                </Button>
              </Card>
            ) : (
              <>
                <button onClick={() => setShowRubric((s) => !s)} className="mb-3 text-sm text-info underline">
                  {showRubric ? "Ẩn rubric" : "Mở rubric số"}
                </button>
                {showRubric && (
                  <div className="mb-4">
                    <RubricViewer issue={d.prompt.issue_statement} compact />
                  </div>
                )}
                {submitted && (
                  <div className="mb-4">
                    <Alert tone="ok" title="Bạn đã nộp phiếu đánh giá">
                      <Link href={`/reports/${d.assignment.id}`} className="underline">
                        Xem / xuất phiếu PDF
                      </Link>
                    </Alert>
                  </div>
                )}
                <PeerReviewForm
                  assignmentId={d.assignment.id}
                  essay={d.version.content}
                  issue={d.prompt.issue_statement}
                  initial={d.review}
                  emptyCriteria={d.empty_criteria}
                  readOnly={submitted || d.round.status !== "open"}
                  onSubmitted={() => q.reload()}
                />
                {submitted && d.ai && (
                  <div className="mt-6">
                    <h2 className="mb-2 font-semibold">Đối chiếu với AI (giáo viên đã cho phép công bố)</h2>
                    <AIGradingReport grading={d.ai} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
