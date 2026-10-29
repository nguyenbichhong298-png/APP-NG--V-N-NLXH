"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PeerAssessmentReport } from "@/components/PeerAssessmentReport";
import { Alert, Button, Loading } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import type { PeerReview, WriterResponse } from "@/lib/types";

interface Data {
  writer_name: string;
  reviewer_name: string;
  prompt: { title: string };
  review: PeerReview;
  response: WriterResponse | null;
  revised_version: { id: string } | null;
}

export default function ReportPage() {
  return <AppShell wide>{() => <Inner />}</AppShell>;
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const q = useApi<Data>(`/api/reports/${id}`);
  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <Alert tone="error">{q.error.message}</Alert>;
  const d = q.data!;
  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Bố cục giống phiếu giấy. Chọn “Lưu dưới dạng PDF” trong hộp thoại in để xuất PDF.</p>
        <Button onClick={() => window.print()}>Xuất PDF</Button>
      </div>
      {d.review.status !== "submitted" && (
        <div className="no-print mb-4">
          <Alert tone="warn">Phiếu này đang là bản nháp.</Alert>
        </div>
      )}
      <PeerAssessmentReport
        writerName={d.writer_name}
        reviewerName={d.reviewer_name}
        promptTitle={d.prompt.title}
        review={d.review}
        response={d.response}
        revisedLink={d.revised_version ? `/compare/${d.revised_version.id}` : null}
      />
    </>
  );
}
