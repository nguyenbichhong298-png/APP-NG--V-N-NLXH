"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DiagnosticErrorSelector } from "@/components/DiagnosticErrorSelector";
import { RubricLevelSelector } from "@/components/RubricLevelSelector";
import { Alert, Badge, Button, Card, Loading, PageHeader } from "@/components/ui";
import { api, ClientError, useApi } from "@/lib/client/api";
import { RUBRIC_2026 } from "@/lib/rubric";
import { emptyCriteria, formatScore, normalizeCriteria, totalOf } from "@/lib/scoring";
import { formSignals } from "@/lib/text";
import type { AIGrading, CriterionScore, EssayVersion, PromptRow, TeacherGrading } from "@/lib/types";

interface Data {
  version: EssayVersion;
  prompt: PromptRow | null;
  author_name: string;
  grading: TeacherGrading | null;
  ai: AIGrading | null;
}

export default function TeacherGradePage() {
  return <AppShell role="teacher" wide>{() => <Inner />}</AppShell>;
}

function Inner() {
  const { versionId } = useParams<{ versionId: string }>();
  const q = useApi<Data>(`/api/teacher-grading/${versionId}`);
  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <Alert tone="error">{q.error.message}</Alert>;
  return <Form data={q.data!} versionId={versionId} />;
}

function Form({ data, versionId }: { data: Data; versionId: string }) {
  const [criteria, setCriteria] = useState<CriterionScore[]>(data.grading?.criteria ?? emptyCriteria());
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const normalized = normalizeCriteria(criteria);
  const s = formSignals(data.version.content);
  const update = (id: string, patch: Partial<CriterionScore>) => setCriteria((cs) => cs.map((c) => (c.criterion_id === id ? { ...c, ...patch } : c)));

  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/teacher-grading/${versionId}`, { method: "PUT", body: { criteria: normalized } });
      setMsg({ tone: "ok", text: "Đã lưu bản chấm của giáo viên. Bản chấm này dùng làm chuẩn đối chiếu trong thống kê." });
    } catch (e) {
      setMsg({ tone: "error", text: (e as ClientError).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Giáo viên chấm đối chiếu"
        subtitle={`${data.author_name} · ${data.version.kind === "original" ? "Bài gốc" : "Bản chỉnh sửa"} (phiên bản ${data.version.version_no})`}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <p className="text-xs text-muted">Đề bài</p>
            <p className="text-sm">{data.prompt?.content}</p>
          </Card>
          <Card>
            <div className="mb-2 flex gap-2 text-xs">
              <Badge>{s.words} chữ</Badge>
              <Badge>{s.paragraphs} đoạn</Badge>
              {data.ai && <Badge tone="info">AI: {formatScore(data.ai.total)} / 2,00</Badge>}
            </div>
            <p className="essay-text text-sm">{data.version.content}</p>
          </Card>
        </div>
        <div className="space-y-4">
          {RUBRIC_2026.criteria.map((c) => {
            const row = normalized.find((x) => x.criterion_id === c.id)!;
            const ai = data.ai?.result.criteria.find((x) => x.criterion_id === c.id);
            return (
              <Card key={c.id}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {c.order}. {c.name}
                  </h3>
                  <div className="flex gap-2 text-xs">
                    <Badge>Tối đa {formatScore(c.maxScore)}</Badge>
                    <Badge tone="accent">GV: {formatScore(row.score)}</Badge>
                    {ai && <Badge tone="info">AI: Mức {ai.level} · {formatScore(ai.score)}</Badge>}
                  </div>
                </div>
                <RubricLevelSelector criterion={c} issue={data.prompt?.issue_statement} value={row.level} onChange={(l) => update(c.id, { level: l })} />
                <div className="mt-3">
                  <DiagnosticErrorSelector criterionId={c.id} selected={row.error_codes} onChange={(codes) => update(c.id, { error_codes: codes })} primary={null} onPrimary={() => {}} />
                </div>
              </Card>
            );
          })}
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-4">
            <span className="font-semibold">Tổng: {formatScore(totalOf(normalized))} / 2,00</span>
            <Button onClick={save} loading={busy}>
              Lưu bản chấm
            </Button>
          </div>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        </div>
      </div>
    </>
  );
}
