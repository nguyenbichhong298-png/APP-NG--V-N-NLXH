"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { RevisionComparison } from "@/components/RevisionComparison";
import { Alert, Loading, PageHeader } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import type { AIGrading, EssayVersion, TeacherGrading } from "@/lib/types";

interface Data {
  original: EssayVersion;
  revised: EssayVersion;
  ai: { original: AIGrading | null; revised: AIGrading | null };
  teacher: { original: TeacherGrading | null; revised: TeacherGrading | null };
}

export default function ComparePage() {
  return <AppShell wide>{() => <Inner />}</AppShell>;
}

function Inner() {
  const { versionId } = useParams<{ versionId: string }>();
  const q = useApi<Data>(`/api/compare/${versionId}`);
  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <Alert tone="error">{q.error.message}</Alert>;
  return (
    <>
      <PageHeader title="So sánh bài viết trước và sau chỉnh sửa" />
      <RevisionComparison {...q.data!} />
    </>
  );
}
