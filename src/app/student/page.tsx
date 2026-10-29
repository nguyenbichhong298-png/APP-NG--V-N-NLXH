"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Alert, Badge, Card, Loading, PageHeader } from "@/components/ui";
import { formatDate, useApi } from "@/lib/client/api";

interface Home {
  rounds: {
    id: string;
    title: string;
    deadline: string | null;
    status: string;
    rubric_published: boolean;
    ai_visible: boolean;
    prompt_title: string;
    essay_status: "draft" | "final" | null;
    original_version_id: string | null;
    reviews_to_do: { id: string; writer_name: string; status: string | null }[];
    feedback_received: { id: string; reviewer_name: string; review_submitted: boolean; response_status: string | null }[];
  }[];
}

export default function StudentHome() {
  return <AppShell role="student">{() => <Inner />}</AppShell>;
}

function Inner() {
  const q = useApi<Home>("/api/student/home");
  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <Alert tone="error">{q.error.message}</Alert>;
  const rounds = q.data!.rounds;
  return (
    <>
      <PageHeader
        title="Bài của tôi"
        subtitle={
          <>
            Trước khi đánh giá bài của bạn, hãy <Link href="/student/rubric" className="text-info underline">tìm hiểu rubric</Link>.
          </>
        }
      />
      {rounds.length === 0 && <Alert tone="info">Chưa có đợt luyện viết nào được mở.</Alert>}
      <div className="space-y-4">
        {rounds.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{r.title}</h2>
                <p className="text-xs text-muted">
                  {r.prompt_title} · Hạn đánh giá: {formatDate(r.deadline)}
                </p>
              </div>
              <Badge tone={r.status === "open" ? "ok" : "neutral"}>{r.status === "open" ? "Đang mở" : "Đã đóng"}</Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-paper p-3 text-sm">
                <p className="font-semibold">Bài viết của tôi</p>
                <p className="mt-1 text-muted">{r.essay_status === "final" ? "Đã nộp" : r.essay_status === "draft" ? "Đang viết nháp" : "Chưa viết"}</p>
                {r.essay_status !== "final" && r.status === "open" && (
                  <Link href={`/student/write/${r.id}`} className="mt-2 inline-block text-info underline">
                    {r.essay_status ? "Viết tiếp" : "Bắt đầu viết"}
                  </Link>
                )}
                {r.original_version_id && r.ai_visible && (
                  <Link href={`/ai/${r.original_version_id}`} className="mt-2 block text-info underline">
                    Xem kết quả AI
                  </Link>
                )}
              </div>
              <div className="rounded-lg bg-paper p-3 text-sm">
                <p className="font-semibold">Bài cần đánh giá</p>
                {!r.rubric_published && r.reviews_to_do.length > 0 && <p className="mt-1 text-xs text-warn">Chờ giáo viên công khai rubric.</p>}
                {r.reviews_to_do.length === 0 && <p className="mt-1 text-muted">Chưa được phân công.</p>}
                <ul className="mt-1 space-y-1">
                  {r.reviews_to_do.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <Link href={`/student/review/${a.id}`} className="text-info underline">
                        Bài của {a.writer_name}
                      </Link>
                      <Badge tone={a.status === "submitted" ? "ok" : a.status === "draft" ? "info" : "warn"}>
                        {a.status === "submitted" ? "Đã nộp" : a.status === "draft" ? "Nháp" : "Chưa làm"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-paper p-3 text-sm">
                <p className="font-semibold">Phản hồi tôi nhận được</p>
                {r.feedback_received.length === 0 && <p className="mt-1 text-muted">Chưa có.</p>}
                <ul className="mt-1 space-y-1">
                  {r.feedback_received.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2">
                      {f.review_submitted ? (
                        <Link href={`/student/feedback/${f.id}`} className="text-info underline">
                          Từ {f.reviewer_name}
                        </Link>
                      ) : (
                        <span className="text-muted">Từ {f.reviewer_name}</span>
                      )}
                      <Badge tone={!f.review_submitted ? "neutral" : f.response_status === "submitted" ? "ok" : "warn"}>
                        {!f.review_submitted ? "Bạn đang chấm" : f.response_status === "submitted" ? "Đã phản hồi" : "Cần phản hồi"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
