"use client";

import { useState } from "react";
import { api, ClientError } from "@/lib/client/api";
import { ACCEPTANCE_LABELS, PLANNED_ACTION_LABELS, type Acceptance, type PlannedAction, type WriterResponse } from "@/lib/types";
import { Alert, Button, Field, Textarea, cx } from "./ui";

/** PHẢN HỒI TỪ NGƯỜI VIẾT: mức độ tiếp nhận, dự kiến điều chỉnh, giải thích. */
export function WriterResponseForm({
  assignmentId,
  initial,
  onSaved,
}: {
  assignmentId: string;
  initial: WriterResponse | null;
  onSaved: (r: WriterResponse) => void;
}) {
  const [acceptance, setAcceptance] = useState<Acceptance | null>(initial?.acceptance ?? null);
  const [actions, setActions] = useState<PlannedAction[]>(initial?.planned_actions ?? []);
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);

  const save = async (submit: boolean) => {
    setSaving(submit ? "submit" : "draft");
    try {
      const r = await api<WriterResponse>(`/api/feedback/${assignmentId}/response`, {
        method: "PUT",
        body: { acceptance, planned_actions: actions, explanation, submit },
      });
      setErrors({});
      setMsg({ tone: "ok", text: submit ? "Đã gửi phản hồi. Bạn có thể bắt đầu chỉnh sửa bài viết." : "Đã lưu nháp." });
      onSaved(r);
    } catch (e) {
      const err = e as ClientError;
      setErrors(err.fields ?? {});
      setMsg({ tone: "error", text: err.message });
    } finally {
      setSaving(null);
    }
  };

  const toggle = (a: PlannedAction) => setActions((xs) => (xs.includes(a) ? xs.filter((x) => x !== a) : [...xs, a]));

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-semibold">
          • Mức độ tiếp nhận góp ý <span className="text-accent">*</span>
        </legend>
        <div className={cx("mt-2 flex flex-wrap gap-2", errors.acceptance && "rounded-lg ring-2 ring-accent/50")}>
          {(Object.keys(ACCEPTANCE_LABELS) as Acceptance[]).map((k) => (
            <label key={k} className={cx("inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", acceptance === k ? "border-accent bg-accent-soft" : "border-line bg-surface")}>
              <input type="radio" name="acceptance" checked={acceptance === k} onChange={() => setAcceptance(k)} className="accent-[var(--accent)]" />
              {ACCEPTANCE_LABELS[k]}
            </label>
          ))}
        </div>
        {errors.acceptance && <p className="mt-1 text-xs text-accent">{errors.acceptance}</p>}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">
          • Dự kiến điều chỉnh <span className="text-accent">*</span>
        </legend>
        <div className={cx("mt-2 flex flex-wrap gap-2", errors.planned_actions && "rounded-lg ring-2 ring-accent/50")}>
          {(Object.keys(PLANNED_ACTION_LABELS) as PlannedAction[]).map((k) => (
            <label key={k} className={cx("inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", actions.includes(k) ? "border-accent bg-accent-soft" : "border-line bg-surface")}>
              <input type="checkbox" checked={actions.includes(k)} onChange={() => toggle(k)} className="accent-[var(--accent)]" />
              {PLANNED_ACTION_LABELS[k]}
            </label>
          ))}
        </div>
        {errors.planned_actions && <p className="mt-1 text-xs text-accent">{errors.planned_actions}</p>}
      </fieldset>

      <Field
        label="Giải thích về quyết định tiếp nhận hoặc không tiếp nhận góp ý"
        hint="Bạn được quyền chủ động lựa chọn nội dung sửa; không bắt buộc tiếp nhận mọi góp ý của bạn hoặc AI."
        error={errors.explanation}
      >
        <Textarea rows={3} value={explanation} invalid={!!errors.explanation} onChange={(e) => setExplanation(e.target.value)} />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => save(false)} loading={saving === "draft"}>
          Lưu nháp
        </Button>
        <Button onClick={() => save(true)} loading={saving === "submit"}>
          Gửi phản hồi
        </Button>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
