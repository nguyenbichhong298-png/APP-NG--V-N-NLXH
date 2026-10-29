"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ClientError, formatDate } from "@/lib/client/api";
import { RUBRIC_2026, type Level } from "@/lib/rubric";
import { formatScore, normalizeCriteria, scoreForLevel, totalOf, validatePeerReview, type ThreeStep } from "@/lib/scoring";
import { formSignals, quoteInText } from "@/lib/text";
import type { CriterionScore, FeedbackCheck, PeerReview } from "@/lib/types";
import { DiagnosticErrorSelector } from "./DiagnosticErrorSelector";
import { RubricLevelSelector } from "./RubricLevelSelector";
import { ThreeStepFeedback } from "./ThreeStepFeedback";
import { Alert, Badge, Button, Card, Field, Textarea } from "./ui";

/** Phiếu chấm trực tuyến: 4 tiêu chí × (mức, điểm, mã lỗi, trích dẫn) + phản hồi 3 bước. */
export function PeerReviewForm({
  assignmentId,
  essay,
  issue,
  initial,
  emptyCriteria,
  onSubmitted,
  readOnly,
}: {
  assignmentId: string;
  essay: string;
  issue: string;
  initial: PeerReview | null;
  emptyCriteria: CriterionScore[];
  onSubmitted: (r: PeerReview) => void;
  readOnly?: boolean;
}) {
  const rubric = RUBRIC_2026;
  const [criteria, setCriteria] = useState<CriterionScore[]>(initial?.criteria ?? emptyCriteria);
  const [fb, setFb] = useState<ThreeStep>({
    highlight: initial?.highlight ?? "",
    primary_error_code: initial?.primary_error_code ?? null,
    main_issue_evidence: initial?.main_issue_evidence ?? "",
    main_issue_explanation: initial?.main_issue_explanation ?? "",
    suggestion: initial?.suggestion ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(initial?.updated_at ?? null);
  const [check, setCheck] = useState<FeedbackCheck | null>(initial?.feedback_check ?? null);
  const [checking, setChecking] = useState(false);
  const dirty = useRef(false);

  const normalized = useMemo(() => normalizeCriteria(criteria, rubric), [criteria, rubric]);
  const total = totalOf(normalized);
  const selectedCodes = normalized.flatMap((c) => c.error_codes);
  const signals = formSignals(essay);
  const payload = (submit: boolean) => ({ criteria: normalized, ...fb, submit });

  const update = (id: CriterionScore["criterion_id"], patch: Partial<CriterionScore>) => {
    dirty.current = true;
    setCriteria((cs) => cs.map((c) => (c.criterion_id === id ? { ...c, ...patch } : c)));
  };

  const save = async (submit: boolean) => {
    if (submit) {
      const local = validatePeerReview(normalized, fb, rubric);
      setErrors(local);
      if (Object.keys(local).length) {
        setMessage({ tone: "error", text: "Phiếu chưa đầy đủ. Vui lòng xem các mục được đánh dấu đỏ." });
        return;
      }
      if (!confirm("Nộp phiếu đánh giá? Sau khi nộp sẽ không sửa được.")) return;
    }
    setSaving(submit ? "submit" : "draft");
    try {
      const r = await api<PeerReview>(`/api/review/${assignmentId}`, { method: "PUT", body: payload(submit) });
      dirty.current = false;
      setSavedAt(r.updated_at);
      setErrors({});
      setMessage({ tone: "ok", text: submit ? "Đã nộp phiếu đánh giá đồng đẳng." : "Đã lưu nháp." });
      if (submit) onSubmitted(r);
    } catch (e) {
      const err = e as ClientError;
      setErrors(err.fields ?? {});
      setMessage({ tone: "error", text: err.message });
    } finally {
      setSaving(null);
    }
  };

  // Tự lưu nháp mỗi 30 giây khi có thay đổi.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    if (readOnly) return;
    const t = setInterval(() => {
      if (dirty.current) void saveRef.current(false);
    }, 30000);
    return () => clearInterval(t);
  }, [readOnly]);

  const runCheck = async () => {
    setChecking(true);
    try {
      setCheck(await api<FeedbackCheck>(`/api/review/${assignmentId}/check`, { method: "POST", body: payload(false) }));
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">I. BẢNG GHI ĐIỂM & CHẨN ĐOÁN LỖI</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">Tổng điểm đánh giá đồng đẳng:</span>
            <span className="rounded-lg bg-accent px-3 py-1 text-base font-bold text-white">
              {formatScore(total)} / {formatScore(rubric.totalMax)}
            </span>
          </div>
        </div>
        <div className="space-y-6">
          {rubric.criteria.map((c) => {
            const row = normalized.find((x) => x.criterion_id === c.id)!;
            const below = row.score !== null && row.score < c.maxScore;
            const quoteOk = !row.evidence || quoteInText(row.evidence, essay);
            return (
              <fieldset key={c.id} className="rounded-xl border border-line p-4">
                <legend className="px-1 text-sm font-semibold">
                  {c.order}. {c.name}
                </legend>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge>Điểm tối đa: {formatScore(c.maxScore)} đ</Badge>
                  <Badge tone={row.score === null ? "neutral" : below ? "warn" : "ok"}>Điểm chấm: {formatScore(row.score)} đ</Badge>
                  {c.id === "hinh_thuc" && (
                    <Badge tone={signals.lengthOk && signals.singleParagraph ? "ok" : "warn"}>
                      Đếm tự động: {signals.words} chữ · {signals.paragraphs} đoạn
                    </Badge>
                  )}
                </div>
                <RubricLevelSelector
                  criterion={c}
                  issue={issue}
                  value={row.level}
                  disabled={readOnly}
                  invalid={!!errors[`criteria.${c.id}.level`]}
                  onChange={(l: Level) => update(c.id, { level: l, score: scoreForLevel(c.id, l, rubric) })}
                />
                {errors[`criteria.${c.id}.level`] && <p className="mt-1 text-xs text-accent">{errors[`criteria.${c.id}.level`]}</p>}

                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold">
                    Mã lỗi chẩn đoán ghi nhận <span className="font-normal text-muted">(nếu bị trừ điểm)</span>
                  </p>
                  <DiagnosticErrorSelector
                    criterionId={c.id}
                    selected={row.error_codes}
                    disabled={readOnly}
                    invalid={!!errors[`criteria.${c.id}.codes`]}
                    onChange={(codes) => update(c.id, { error_codes: codes })}
                    primary={fb.primary_error_code}
                    onPrimary={(code) => {
                      dirty.current = true;
                      setFb((f) => ({ ...f, primary_error_code: code }));
                    }}
                  />
                  {errors[`criteria.${c.id}.codes`] && <p className="text-xs text-accent">{errors[`criteria.${c.id}.codes`]}</p>}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field label="Trích dẫn biểu hiện cụ thể trong bài" hint={quoteOk ? undefined : "Trích dẫn chưa khớp nguyên văn bài viết – hãy chép đúng từng chữ."}>
                    <Textarea
                      rows={2}
                      value={row.evidence}
                      disabled={readOnly}
                      onChange={(e) => update(c.id, { evidence: e.target.value })}
                      placeholder="Chép nguyên văn câu/cụm từ làm căn cứ."
                    />
                  </Field>
                  <Field label={below ? "Giải thích nguyên nhân (nếu không chọn mã lỗi)" : "Ghi chú thêm"}>
                    <Textarea rows={2} value={row.explanation} disabled={readOnly} onChange={(e) => update(c.id, { explanation: e.target.value })} />
                  </Field>
                </div>
              </fieldset>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted">
          Điểm được cộng tự động theo mức điểm của rubric. Số lượng mã lỗi không làm trừ thêm điểm.
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-bold">II. PHẢN HỒI LẬP LUẬN (Nhận xét theo mô hình 3 bước)</h2>
        <ThreeStepFeedback
          value={fb}
          onChange={(v) => {
            dirty.current = true;
            setFb(v);
          }}
          selectedCodes={selectedCodes}
          errors={errors}
          disabled={readOnly}
          onCheck={runCheck}
          checking={checking}
          check={check}
        />
      </Card>

      {!readOnly && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted">{savedAt ? `Đã lưu lúc ${formatDate(savedAt)}` : "Chưa lưu"} · Tự lưu nháp mỗi 30 giây</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => save(false)} loading={saving === "draft"}>
                Lưu nháp
              </Button>
              <Button onClick={() => save(true)} loading={saving === "submit"}>
                Nộp phiếu đánh giá
              </Button>
            </div>
          </div>
          {message && (
            <div className="mt-2">
              <Alert tone={message.tone}>{message.text}</Alert>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
