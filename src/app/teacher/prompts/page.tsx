"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Alert, Badge, Button, Card, Field, Input, Loading, PageHeader, Textarea } from "@/components/ui";
import { api, ClientError, formatDate, useApi } from "@/lib/client/api";
import { suggestSolutionLevel } from "@/lib/scoring";
import type { PromptRow, SolutionGroup } from "@/lib/types";

export default function PromptsPage() {
  return <AppShell role="teacher" wide>{() => <Inner />}</AppShell>;
}

type Draft = Pick<PromptRow, "title" | "content" | "issue_statement" | "solution_groups" | "grading_guide">;

const blank = (): Draft => ({
  title: "",
  content: "",
  issue_statement: "",
  solution_groups: [
    { id: "1", label: "Ý 1", items: [{ id: "1.1", text: "" }] },
    { id: "2", label: "Ý 2", items: [{ id: "2.1", text: "" }] },
  ],
  grading_guide: "",
});

function Inner() {
  const prompts = useApi<PromptRow[]>("/api/prompts");
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);

  if (prompts.loading && !prompts.data) return <Loading />;
  return (
    <>
      <PageHeader
        title="Đề bài & hướng dẫn chấm"
        subtitle="Với mỗi đề mới, giáo viên nhập và xác nhận vấn đề nghị luận, các nhóm ý giải pháp và hướng dẫn chấm. AI chỉ chấm đề đã xác nhận."
        actions={<Button onClick={() => setEditing({ id: null, draft: blank() })}>+ Đề mới</Button>}
      />
      {editing && (
        <PromptEditor
          id={editing.id}
          initial={editing.draft}
          onDone={async () => {
            setEditing(null);
            await prompts.reload();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      <div className="space-y-3">
        {prompts.data?.map((p) => (
          <PromptCard key={p.id} p={p} onEdit={() => setEditing({ id: p.id, draft: p })} onChanged={prompts.reload} />
        ))}
      </div>
    </>
  );
}

function PromptCard({ p, onEdit, onChanged }: { p: PromptRow; onEdit: () => void; onChanged: () => Promise<void> }) {
  const [err, setErr] = useState<string | null>(null);
  const confirmIt = async () => {
    try {
      await api(`/api/prompts/${p.id}`, { method: "POST", body: {} });
      await onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{p.title}</h3>
          <p className="mt-1 text-sm">{p.content}</p>
        </div>
        <div className="flex items-center gap-2">
          {p.confirmed ? <Badge tone="ok">Đã xác nhận {formatDate(p.confirmed_at)}</Badge> : <Badge tone="warn">Chưa xác nhận</Badge>}
          <Button variant="secondary" onClick={onEdit}>
            Sửa
          </Button>
          {!p.confirmed && <Button onClick={confirmIt}>Xác nhận yêu cầu chấm</Button>}
        </div>
      </div>
      <p className="mt-3 text-sm">
        <span className="font-semibold">Vấn đề nghị luận: </span>
        {p.issue_statement}
      </p>
      <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
        {p.solution_groups.map((g) => (
          <div key={g.id} className="rounded-lg bg-paper p-3">
            <p className="font-semibold">{g.label}</p>
            <ul className="list-disc pl-5">
              {g.items.map((i) => (
                <li key={i.id}>
                  {i.id}: {i.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {err && (
        <div className="mt-2">
          <Alert tone="error">{err}</Alert>
        </div>
      )}
    </Card>
  );
}

function PromptEditor({ id, initial, onDone, onCancel }: { id: string | null; initial: Draft; onDone: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [err, setErr] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);
  const setGroups = (fn: (g: SolutionGroup[]) => SolutionGroup[]) => setD((x) => ({ ...x, solution_groups: fn(x.solution_groups) }));

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        title: d.title,
        content: d.content,
        issue_statement: d.issue_statement,
        solution_groups: d.solution_groups,
        grading_guide: d.grading_guide,
      };
      await api(id ? `/api/prompts/${id}` : "/api/prompts", { method: id ? "PUT" : "POST", body });
      onDone();
    } catch (e) {
      setErr(e as ClientError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6 border-accent/40">
      <h2 className="mb-3 font-semibold">{id ? "Sửa đề (cần xác nhận lại sau khi sửa)" : "Đề mới"}</h2>
      <div className="space-y-3">
        <Field label="Tên đề" required error={err?.fields?.title}>
          <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </Field>
        <Field label="Nội dung đề" required error={err?.fields?.content}>
          <Textarea rows={3} value={d.content} onChange={(e) => setD({ ...d, content: e.target.value })} />
        </Field>
        <Field label="Vấn đề nghị luận (dùng cho tiêu chí 1)" required error={err?.fields?.issue_statement}>
          <Textarea rows={2} value={d.issue_statement} onChange={(e) => setD({ ...d, issue_statement: e.target.value })} />
        </Field>
        <div>
          <p className="text-sm font-semibold">Yêu cầu nội dung cụ thể (dùng cho tiêu chí 2)</p>
          <p className="text-xs text-muted">
            Rubric 2026 tính mức theo số ý nêu được trong “Ý 1” và “Ý 2”. Với đề khác, nhập nhóm ý tương ứng theo hướng dẫn chấm của đề đó.
          </p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {d.solution_groups.map((g, gi) => (
              <div key={g.id} className="rounded-lg border border-line p-3">
                <Input value={g.label} onChange={(e) => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, label: e.target.value } : x)))} className="font-semibold" />
                {g.items.map((it, ii) => (
                  <div key={ii} className="mt-2 flex gap-2">
                    <span className="w-10 pt-2 text-xs text-muted">{it.id}</span>
                    <Textarea
                      rows={2}
                      value={it.text}
                      onChange={(e) =>
                        setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, items: x.items.map((y, j) => (j === ii ? { ...y, text: e.target.value } : y)) } : x)))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, items: x.items.filter((_, j) => j !== ii) } : x)))}
                      className="text-xs text-accent"
                      aria-label="Xóa ý"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="mt-2 text-xs text-info underline"
                  onClick={() => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, items: [...x.items, { id: `${x.id}.${x.items.length + 1}`, text: "" }] } : x)))}
                >
                  + Thêm ý
                </button>
              </div>
            ))}
          </div>
          <SolutionLevelHelper />
        </div>
        <Field label="Hướng dẫn chấm bổ sung (tùy chọn)">
          <Textarea rows={3} value={d.grading_guide} onChange={(e) => setD({ ...d, grading_guide: e.target.value })} />
        </Field>
        {err && <Alert tone="error">{err.message}</Alert>}
        <div className="flex gap-2">
          <Button onClick={save} loading={busy}>
            Lưu đề
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Hủy
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Bảng tra mức tiêu chí 2 theo số ý — đúng bảng gốc; ô trống là trường hợp rubric gốc chưa quy định. */
function SolutionLevelHelper() {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-info">Tra mức tiêu chí 2 theo số ý nêu được (Rubric 2026)</summary>
      <table className="mt-2 border-collapse text-center text-xs">
        <thead>
          <tr>
            <th className="border border-line p-1.5">Ý 1 \ Ý 2</th>
            {[0, 1, 2, 3].map((n2) => (
              <th key={n2} className="border border-line p-1.5">
                {n2}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map((n1) => (
            <tr key={n1}>
              <th className="border border-line p-1.5">{n1}</th>
              {[0, 1, 2, 3].map((n2) => {
                const l = suggestSolutionLevel(n1, n2);
                return (
                  <td key={n2} className={`border border-line p-1.5 ${l ? "" : "bg-warn-soft text-warn"}`}>
                    {l ? `Mức ${l}` : "GV quyết định"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
