"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EssayRevisionEditor } from "@/components/EssayRevisionEditor";
import { Alert, Card, Loading, PageHeader } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import type { EssayVersion, Round } from "@/lib/types";

interface Data {
  round: Round;
  prompt: { id: string; title: string; content: string };
  original: EssayVersion | null;
}

export default function WritePage() {
  return <AppShell role="student">{(me) => <Inner userId={me.user.id} />}</AppShell>;
}

function Inner({ userId }: { userId: string }) {
  const { roundId } = useParams<{ roundId: string }>();
  const q = useApi<Data>(`/api/student/essays/${roundId}`);
  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <Alert tone="error">{q.error.message}</Alert>;
  const d = q.data!;
  return (
    <>
      <PageHeader title="Viết đoạn văn" subtitle={d.round.title} actions={<Link href="/student" className="text-sm text-info underline">← Bài của tôi</Link>} />
      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase text-muted">Đề bài</p>
        <p className="mt-1">{d.prompt.content}</p>
      </Card>
      {d.original?.status === "final" ? (
        <Alert tone="ok" title="Bạn đã nộp bài">
          Bài viết đã được lưu là phiên bản gốc. Sau khi nhận phản hồi từ bạn, bạn có thể chỉnh sửa thành phiên bản mới.
        </Alert>
      ) : (
        <Card>
          <EssayRevisionEditor
            endpoint={`/api/student/essays/${roundId}`}
            initialText={d.original?.content ?? ""}
            draftKey={`essay:${userId}:${roundId}`}
            savedAt={d.original?.created_at}
            onSubmitted={() => q.reload()}
          />
        </Card>
      )}
    </>
  );
}
