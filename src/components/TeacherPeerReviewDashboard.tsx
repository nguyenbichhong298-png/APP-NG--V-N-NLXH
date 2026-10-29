"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ClientError, formatDate, useApi } from "@/lib/client/api";
import type { PromptRow, Round } from "@/lib/types";
import { Alert, Badge, Button, Card, Field, Input, Loading, PageHeader } from "./ui";

type RoundRow = Round & { prompt_title: string; assignment_count: number; submitted_count: number };

/** Trang ĐÁNH GIÁ ĐỒNG ĐẲNG của giáo viên: danh sách đợt và tạo đợt mới. */
export function TeacherPeerReviewDashboard() {
  const router = useRouter();
  const rounds = useApi<RoundRow[]>("/api/rounds");
  const prompts = useApi<PromptRow[]>("/api/prompts");
  const [title, setTitle] = useState("");
  const [promptId, setPromptId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [err, setErr] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const r = await api<Round>("/api/rounds", {
        method: "POST",
        body: { title, prompt_id: promptId, deadline: deadline ? new Date(deadline).toISOString() : null },
      });
      router.push(`/teacher/rounds/${r.id}`);
    } catch (e) {
      setErr(e as ClientError);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="ĐÁNH GIÁ ĐỒNG ĐẲNG" subtitle="Tạo đợt đánh giá, ghép cặp, công khai rubric và theo dõi tiến độ." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <h2 className="mb-3 font-semibold">Các đợt đánh giá</h2>
          {rounds.loading && <Loading />}
          {rounds.error && <Alert tone="error">{rounds.error.message}</Alert>}
          {rounds.data?.length === 0 && <p className="text-sm text-muted">Chưa có đợt nào. Tạo đợt đầu tiên ở khung bên cạnh.</p>}
          <ul className="divide-y divide-line">
            {rounds.data?.map((r) => (
              <li key={r.id}>
                <Link href={`/teacher/rounds/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-paper">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-muted">
                      {r.prompt_title} · Hạn: {formatDate(r.deadline)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={r.status === "open" ? "ok" : "neutral"}>{r.status === "open" ? "Đang mở" : r.status === "closed" ? "Đã đóng" : "Nháp"}</Badge>
                    <Badge tone={r.rubric_published ? "info" : "warn"}>{r.rubric_published ? "Đã công khai rubric" : "Chưa công khai rubric"}</Badge>
                    <Badge>
                      {r.submitted_count}/{r.assignment_count} phiếu
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Tạo đợt đánh giá</h2>
          <div className="space-y-3">
            <Field label="Tên đợt" error={err?.fields?.title} required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Đợt 1 – Lớp 12A1" />
            </Field>
            <Field label="Đề bài" error={err?.fields?.prompt_id} required>
              <select className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={promptId} onChange={(e) => setPromptId(e.target.value)}>
                <option value="">— Chọn đề —</option>
                {prompts.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} {p.confirmed ? "" : "(chưa xác nhận)"}
                  </option>
                ))}
              </select>
            </Field>
            {prompts.data?.find((p) => p.id === promptId && !p.confirmed) && (
              <Alert tone="warn">Đề này chưa được xác nhận yêu cầu nội dung. AI sẽ chưa chấm cho đến khi bạn xác nhận ở trang Đề bài.</Alert>
            )}
            <Field label="Thời hạn nộp phiếu">
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
            <Button onClick={create} loading={busy} className="w-full">
              Tạo đợt
            </Button>
            {err && !err.fields && <Alert tone="error">{err.message}</Alert>}
            <p className="text-xs text-muted">
              Cần đề mới? <Link href="/teacher/prompts" className="text-info underline">Quản lí đề bài</Link>
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
