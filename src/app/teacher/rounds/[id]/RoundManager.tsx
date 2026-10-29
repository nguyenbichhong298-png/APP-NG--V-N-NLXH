"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RoundStatsPanel } from "@/components/RoundStatsPanel";
import { Alert, Badge, Button, Card, Field, Input, Loading, PageHeader, cx } from "@/components/ui";
import { api, ClientError, formatDate, useApi } from "@/lib/client/api";
import { formatScore } from "@/lib/scoring";
import type { RoundStats } from "@/lib/stats";
import { ACCEPTANCE_LABELS, PLANNED_ACTION_LABELS, type Assignment, type PairingMode, type Profile, type PromptRow, type Round } from "@/lib/types";

interface Detail {
  round: Round;
  prompt: PromptRow | null;
  students: Profile[];
  essays: {
    essay_id: string;
    author_id: string;
    author_name: string;
    versions: { id: string; version_no: number; kind: string; status: string; word_count: number; submitted_at: string | null; ai_total: number | null; teacher_total: number | null }[];
  }[];
  assignments: (Assignment & {
    writer_name: string;
    reviewer_name: string;
    review_status: string | null;
    review_total: number | null;
    review_codes: string[];
    primary_error_code: string | null;
    response_status: string | null;
    acceptance: keyof typeof ACCEPTANCE_LABELS | null;
    planned_actions: (keyof typeof PLANNED_ACTION_LABELS)[];
    revised_version_id: string | null;
  })[];
}

export default function RoundManager() {
  return <AppShell role="teacher" wide>{() => <Inner />}</AppShell>;
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const detail = useApi<Detail>(`/api/rounds/${id}`);
  const [tab, setTab] = useState<"track" | "essays" | "pairing" | "stats">("track");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (detail.loading && !detail.data) return <Loading />;
  if (detail.error) return <Alert tone="error">{detail.error.message}</Alert>;
  const d = detail.data!;
  const r = d.round;

  const patch = async (body: Partial<Round>) => {
    try {
      await api(`/api/rounds/${id}`, { method: "PATCH", body });
      setMsg({ tone: "ok", text: "Đã cập nhật." });
      await detail.reload();
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    }
  };

  return (
    <>
      <PageHeader
        title={r.title}
        subtitle={
          <>
            Đề: {d.prompt?.title} {d.prompt && !d.prompt.confirmed && <Badge tone="warn">Đề chưa xác nhận – AI chưa chấm</Badge>}
          </>
        }
        actions={
          <Link href="/teacher" className="text-sm text-info underline">
            ← Tất cả đợt
          </Link>
        }
      />

      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Toggle label="Công khai rubric (Bước 1)" on={r.rubric_published} onChange={(v) => patch({ rubric_published: v })} hint="Học sinh chỉ chấm được sau khi rubric được công khai." />
          <Toggle label="Công bố kết quả AI" on={r.ai_visible} onChange={(v) => patch({ ai_visible: v })} hint="Học sinh chỉ thấy sau khi hoàn thành phiếu của mình." />
          <Toggle label="Đợt đang mở" on={r.status === "open"} onChange={(v) => patch({ status: v ? "open" : "closed" })} hint="Đóng đợt sẽ khóa việc nộp bài và phiếu." />
          <DeadlineEditor value={r.deadline} onSave={(v) => patch({ deadline: v })} />
        </div>
        {msg && (
          <div className="mt-3">
            <Alert tone={msg.tone}>{msg.text}</Alert>
          </div>
        )}
      </Card>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {(
          [
            ["track", "Theo dõi phiếu"],
            ["essays", "Bài viết & phiên bản"],
            ["pairing", "Ghép cặp / phân nhóm"],
            ["stats", "Thống kê"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={cx("-mb-px border-b-2 px-4 py-2 text-sm", tab === k ? "border-accent font-semibold text-accent" : "border-transparent text-muted")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "track" && <Tracking d={d} />}
      {tab === "essays" && <Essays d={d} reload={detail.reload} />}
      {tab === "pairing" && <Pairing d={d} reload={detail.reload} />}
      {tab === "stats" && <Stats id={id} />}
    </>
  );
}

function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint: string }) {
  return (
    <div>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center gap-2 text-sm font-medium">
        <span className={cx("relative h-5 w-9 rounded-full transition", on ? "bg-ok" : "bg-black/20")}>
          <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white transition", on ? "left-4.5" : "left-0.5")} />
        </span>
        {label}
      </button>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const dt = new Date(iso);
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function DeadlineEditor({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [v, setV] = useState(toLocalInput(value));
  return (
    <div>
      <p className="text-sm font-medium">Thời hạn</p>
      <div className="mt-1 flex gap-1">
        <Input type="datetime-local" value={v} onChange={(e) => setV(e.target.value)} />
        <Button variant="secondary" onClick={() => onSave(v ? new Date(v).toISOString() : null)}>
          Lưu
        </Button>
      </div>
    </div>
  );
}

function Tracking({ d }: { d: Detail }) {
  const done = d.assignments.filter((a) => a.review_status === "submitted").length;
  if (d.assignments.length === 0) return <Alert tone="info">Chưa có phân công. Mở thẻ “Ghép cặp / phân nhóm” để phân công người đánh giá.</Alert>;
  return (
    <Card className="overflow-x-auto">
      <p className="mb-3 text-sm text-muted">
        Hoàn thành {done}/{d.assignments.length} phiếu.
      </p>
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-2">Nhóm</th>
            <th>Người đánh giá</th>
            <th>Người viết</th>
            <th>Phiếu</th>
            <th>Điểm ĐĐ</th>
            <th>Mã lỗi (chính)</th>
            <th>Tiếp nhận góp ý</th>
            <th>Bài sửa</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {d.assignments.map((a) => (
            <tr key={a.id} className="border-b border-line/70 align-top">
              <td className="py-2 text-muted">{a.group_label ?? "—"}</td>
              <td>{a.reviewer_name}</td>
              <td>{a.writer_name}</td>
              <td>
                <Badge tone={a.review_status === "submitted" ? "ok" : a.review_status === "draft" ? "info" : "warn"}>
                  {a.review_status === "submitted" ? "Đã nộp" : a.review_status === "draft" ? "Đang làm" : a.essay_version_id ? "Chưa bắt đầu" : "Chờ bài"}
                </Badge>
              </td>
              <td>{a.review_total != null ? formatScore(a.review_total) : "—"}</td>
              <td className="font-mono text-xs">
                {a.review_codes.join(", ") || "—"}
                {a.primary_error_code && <span className="block font-semibold text-accent">chính: {a.primary_error_code}</span>}
              </td>
              <td className="text-xs">
                {a.response_status === "submitted" && a.acceptance ? (
                  <>
                    <span className="font-medium">{ACCEPTANCE_LABELS[a.acceptance]}</span>
                    <span className="block text-muted">{a.planned_actions.map((p) => PLANNED_ACTION_LABELS[p]).join("; ")}</span>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td>
                {a.revised_version_id ? (
                  <Link href={`/compare/${a.revised_version_id}`} className="text-info underline">
                    So sánh
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="space-x-2 whitespace-nowrap">
                {a.review_status && (
                  <Link href={`/reports/${a.id}`} className="text-info underline">
                    Xem phiếu
                  </Link>
                )}
                {a.essay_version_id && (
                  <Link href={`/teacher/grade/${a.essay_version_id}`} className="text-info underline">
                    Chấm đối chiếu
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Essays({ d, reload }: { d: Detail; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const grade = async (versionId: string) => {
    setBusy(versionId);
    setErr(null);
    try {
      await api(`/api/ai-grading/${versionId}`, { method: "POST", body: {} });
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const missing = d.students.filter((s) => !d.essays.some((e) => e.author_id === s.id));
  return (
    <Card className="overflow-x-auto">
      {err && (
        <div className="mb-3">
          <Alert tone="error">{err}</Alert>
        </div>
      )}
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-2">Học sinh</th>
            <th>Phiên bản</th>
            <th>Trạng thái</th>
            <th>Số chữ</th>
            <th>AI</th>
            <th>GV</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {d.essays.flatMap((e) =>
            e.versions.map((v, i) => (
              <tr key={v.id} className="border-b border-line/70">
                <td className="py-2">{i === 0 ? e.author_name : ""}</td>
                <td>
                  {v.kind === "original" ? "Bài gốc" : "Bản sửa"} (v{v.version_no})
                </td>
                <td>
                  <Badge tone={v.status === "final" ? "ok" : "neutral"}>{v.status === "final" ? `Đã nộp ${formatDate(v.submitted_at)}` : "Nháp"}</Badge>
                </td>
                <td>{v.word_count}</td>
                <td>{formatScore(v.ai_total)}</td>
                <td>{formatScore(v.teacher_total)}</td>
                <td className="space-x-2 whitespace-nowrap">
                  {v.status === "final" && (
                    <>
                      <Link href={`/teacher/grade/${v.id}`} className="text-info underline">
                        Chấm GV
                      </Link>
                      <Link href={`/ai/${v.id}`} className="text-info underline">
                        Xem AI
                      </Link>
                      <button onClick={() => grade(v.id)} disabled={busy === v.id || !d.prompt?.confirmed} className="text-info underline disabled:text-muted disabled:no-underline">
                        {busy === v.id ? "AI đang chấm…" : v.ai_total == null ? "AI chấm" : "AI chấm lại"}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      {missing.length > 0 && <p className="mt-3 text-xs text-muted">Chưa viết bài: {missing.map((s) => s.full_name).join(", ")}</p>}
    </Card>
  );
}

function Pairing({ d, reload }: { d: Detail; reload: () => Promise<void> }) {
  const [mode, setMode] = useState<PairingMode>("pairs");
  const [size, setSize] = useState(3);
  const [selected, setSelected] = useState<string[]>(d.students.map((s) => s.id));
  const [onlySubmitted, setOnlySubmitted] = useState(true);
  const [manual, setManual] = useState<{ reviewerId: string; writerId: string }>({ reviewerId: "", writerId: "" });
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (body: unknown) => {
    setBusy(true);
    try {
      const r = await api<{ created: number; kept: number }>(`/api/rounds/${d.round.id}/pairing`, { method: "POST", body });
      setMsg({ tone: "ok", text: `Đã tạo ${r.created} phân công; giữ nguyên ${r.kept} phân công đã có phiếu.` });
      await reload();
    } catch (e) {
      setMsg({ tone: "error", text: (e as ClientError).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/assignments/${id}`, { method: "DELETE" });
      await reload();
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h3 className="font-semibold">Ghép cặp tự động</h3>
        <div className="mt-3 space-y-3 text-sm">
          {(
            [
              ["pairs", "Ghép đôi đánh giá chéo (A↔B)"],
              ["rotation", "Xoay vòng (A→B→C→…→A)"],
              ["groups", "Phân nhóm (mỗi bạn chấm mọi bài trong nhóm)"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="radio" checked={mode === k} onChange={() => setMode(k)} className="accent-[var(--accent)]" />
              {label}
            </label>
          ))}
          {mode === "groups" && (
            <Field label="Số bạn mỗi nhóm">
              <Input type="number" min={2} max={6} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            </Field>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={onlySubmitted} onChange={(e) => setOnlySubmitted(e.target.checked)} className="accent-[var(--accent)]" />
            Chỉ ghép những bạn đã nộp bài
          </label>
          <div className="max-h-56 overflow-auto rounded-lg border border-line p-2">
            {d.students.map((s) => (
              <label key={s.id} className="flex items-center gap-2 py-0.5">
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={(e) => setSelected((xs) => (e.target.checked ? [...xs, s.id] : xs.filter((x) => x !== s.id)))}
                  className="accent-[var(--accent)]"
                />
                {s.full_name}
                {d.essays.some((e) => e.author_id === s.id && e.versions.some((v) => v.kind === "original" && v.status === "final")) ? (
                  <Badge tone="ok">đã nộp</Badge>
                ) : (
                  <Badge>chưa nộp</Badge>
                )}
              </label>
            ))}
          </div>
          <Button
            loading={busy}
            onClick={() => {
              if (d.assignments.length && !confirm("Các phân công chưa bắt đầu sẽ được thay bằng phân công mới. Tiếp tục?")) return;
              void run({ mode, student_ids: selected, group_size: size, only_submitted: onlySubmitted });
            }}
          >
            Tạo phân công
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold">Phân công thủ công</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Field label="Người đánh giá">
            <select className="w-full rounded-lg border border-line bg-surface px-2 py-2" value={manual.reviewerId} onChange={(e) => setManual((m) => ({ ...m, reviewerId: e.target.value }))}>
              <option value="">—</option>
              {d.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bài của">
            <select className="w-full rounded-lg border border-line bg-surface px-2 py-2" value={manual.writerId} onChange={(e) => setManual((m) => ({ ...m, writerId: e.target.value }))}>
              <option value="">—</option>
              {d.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Button
          className="mt-3"
          variant="secondary"
          disabled={!manual.reviewerId || !manual.writerId}
          onClick={() =>
            run({
              mode: "manual",
              student_ids: [],
              manual: [
                ...d.assignments.map((a) => ({ reviewerId: a.reviewer_id, writerId: a.writer_id, group: a.group_label })),
                { ...manual, group: null },
              ],
            })
          }
        >
          Thêm phân công
        </Button>
        <ul className="mt-4 divide-y divide-line text-sm">
          {d.assignments.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-1.5">
              <span>
                {a.reviewer_name} → bài của {a.writer_name} {a.group_label && <span className="text-muted">({a.group_label})</span>}
              </span>
              {!a.review_status && (
                <button onClick={() => remove(a.id)} className="text-xs text-accent underline">
                  Xóa
                </button>
              )}
            </li>
          ))}
        </ul>
        {msg && (
          <div className="mt-3">
            <Alert tone={msg.tone}>{msg.text}</Alert>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stats({ id }: { id: string }) {
  const s = useApi<{ stats: RoundStats }>(`/api/rounds/${id}/stats`);
  if (s.loading) return <Loading />;
  if (s.error) return <Alert tone="error">{s.error.message}</Alert>;
  return <RoundStatsPanel stats={s.data!.stats} />;
}
