"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AIGradingReport } from "@/components/AIGradingReport";
import { Alert, Card, Loading, PageHeader } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import type { AIGrading, EssayVersion } from "@/lib/types";

interface Data {
  version: EssayVersion;
  prompt: { title: string; content: string; confirmed: boolean };
  grading: AIGrading | null;
  ai_configured: boolean;
}

export default function AIPage() {
  return <AppShell wide>{() => <Inner />}</AppShell>;
}

function Inner() {
  const { versionId } = useParams<{ versionId: string }>();
  const q = useApi<Data>(`/api/ai-grading/${versionId}`);
  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <Alert tone="error">{q.error.message}</Alert>;
  const d = q.data!;
  return (
    <>
      <PageHeader title="AI chấm và chẩn đoán" subtitle={`${d.prompt.title} · ${d.version.kind === "original" ? "Bài gốc" : "Bản chỉnh sửa"} (phiên bản ${d.version.version_no})`} />
      <Card className="mb-5">
        <p className="essay-text text-[15px]">{d.version.content}</p>
      </Card>
      {d.grading ? (
        <AIGradingReport grading={d.grading} />
      ) : !d.prompt.confirmed ? (
        <Alert tone="warn">Giáo viên chưa xác nhận yêu cầu nội dung của đề này nên AI chưa chấm.</Alert>
      ) : !d.ai_configured ? (
        <Alert tone="warn">Máy chủ chưa cấu hình khóa Claude API.</Alert>
      ) : (
        <Alert tone="info">AI đang chấm hoặc chưa chấm bài này. Vui lòng quay lại sau ít phút.</Alert>
      )}
    </>
  );
}
