"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ErrorCodeTable, RubricViewer } from "@/components/RubricViewer";
import { Alert, Button, Card, Field, Loading, PageHeader, Textarea } from "@/components/ui";
import { api, formatDate, useApi } from "@/lib/client/api";
import type { Rubric } from "@/lib/rubric";
import type { RubricConfirmation } from "@/lib/types";

export default function TeacherRubricPage() {
  return <AppShell role="teacher" wide>{() => <Inner />}</AppShell>;
}

function Inner() {
  const info = useApi<{ rubric: Rubric; confirmation: RubricConfirmation | null }>("/api/rubric");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmIt = async () => {
    setBusy(true);
    try {
      await api("/api/rubric", { method: "POST", body: { notes } });
      await info.reload();
    } finally {
      setBusy(false);
    }
  };
  if (info.loading && !info.data) return <Loading />;
  const c = info.data?.confirmation;
  return (
    <>
      <PageHeader title="Rubric số" subtitle={`${info.data?.rubric.title} · phiên bản ${info.data?.rubric.version}`} />
      <div className="space-y-6">
        <Card>
          <h2 className="font-semibold">Xác nhận mức điểm</h2>
          <p className="mt-1 text-sm text-muted">
            Mô tả và điểm từng mức được giữ nguyên Rubric gốc. Hệ thống tự cộng điểm theo các mức đã được giáo viên xác nhận. Xem các ghi chú đối chiếu
            bên dưới bảng (những điểm tài liệu gốc chưa thống nhất).
          </p>
          {c ? (
            <Alert tone="ok" title={`Đã xác nhận lúc ${formatDate(c.confirmed_at)}`}>
              {c.notes || "Không có ghi chú."}
            </Alert>
          ) : (
            <Alert tone="warn">Rubric chưa được giáo viên xác nhận.</Alert>
          )}
          <div className="mt-3 space-y-2">
            <Field label="Ghi chú quyết định của giáo viên" hint="Ví dụ: Tiêu chí 3 – bài đáp ứng 02/03 yêu cầu xếp Mức 3.">
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button onClick={confirmIt} loading={busy}>
              Xác nhận rubric
            </Button>
          </div>
        </Card>
        <RubricViewer />
        <Card>
          <h2 className="mb-3 font-semibold">Bảng mã lỗi chẩn đoán nhanh</h2>
          <ErrorCodeTable />
        </Card>
      </div>
    </>
  );
}
