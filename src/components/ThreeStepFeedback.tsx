"use client";

import { ERROR_CODE_MAP } from "@/lib/error-codes";
import type { ThreeStep } from "@/lib/scoring";
import type { FeedbackCheck } from "@/lib/types";
import { Alert, Badge, Button, Field, Textarea } from "./ui";

/** Phản hồi theo mô hình ba bước: Điểm sáng – Lỗi gãy lập luận chính – Gợi ý điều chỉnh. */
export function ThreeStepFeedback({
  value,
  onChange,
  selectedCodes,
  errors,
  disabled,
  onCheck,
  checking,
  check,
}: {
  value: ThreeStep;
  onChange: (v: ThreeStep) => void;
  selectedCodes: string[];
  errors: Record<string, string>;
  disabled?: boolean;
  onCheck?: () => void;
  checking?: boolean;
  check?: FeedbackCheck | null;
}) {
  const set = <K extends keyof ThreeStep>(k: K, v: ThreeStep[K]) => onChange({ ...value, [k]: v });
  const primary = value.primary_error_code ? ERROR_CODE_MAP[value.primary_error_code] : null;
  return (
    <div className="space-y-5">
      <Field
        label="1. ĐIỂM SÁNG NỔI BẬT"
        hint="Ưu điểm về lập luận/ý kiến. Ghi nhận ít nhất một ưu điểm thực sự của bài viết."
        error={errors.highlight}
        required
      >
        <Textarea
          rows={3}
          value={value.highlight}
          disabled={disabled}
          invalid={!!errors.highlight}
          onChange={(e) => set("highlight", e.target.value)}
          placeholder="Ví dụ: Bạn đã xác định đúng vấn đề nghị luận, dẫn chứng phù hợp và thể hiện quan điểm rõ ràng."
        />
      </Field>

      <div className="space-y-3">
        <p className="text-sm font-semibold">
          2. LỖI GÃY LẬP LUẬN CHÍNH <span className="text-accent">*</span>
          <span className="block text-xs font-normal text-muted">Ghi mã lỗi + biểu hiện. Chọn lỗi chính trong các mã đã tích ở bảng điểm.</span>
        </p>
        <Field label="Mã lỗi chính" error={errors.primary_error_code}>
          <select
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            value={value.primary_error_code ?? ""}
            disabled={disabled}
            onChange={(e) => set("primary_error_code", e.target.value || null)}
          >
            <option value="">{selectedCodes.length ? "— Chọn lỗi chính —" : "(Chưa tích mã lỗi nào)"}</option>
            {selectedCodes.map((c) => (
              <option key={c} value={c}>
                {c} – {ERROR_CODE_MAP[c]?.name}
              </option>
            ))}
          </select>
        </Field>
        {primary && <p className="rounded-lg bg-paper px-3 py-2 text-xs text-muted">Gợi ý khắc phục của mã {primary.code}: {primary.fix}</p>}
        <Field label="Biểu hiện (trích dẫn từ bài)" error={errors.main_issue_evidence}>
          <Textarea
            rows={2}
            value={value.main_issue_evidence}
            disabled={disabled}
            invalid={!!errors.main_issue_evidence}
            onChange={(e) => set("main_issue_evidence", e.target.value)}
            placeholder="Chép nguyên văn câu/cụm từ trong bài thể hiện lỗi."
          />
        </Field>
        <Field label="Vì sao cần cải thiện" error={errors.main_issue_explanation}>
          <Textarea
            rows={2}
            value={value.main_issue_explanation}
            disabled={disabled}
            invalid={!!errors.main_issue_explanation}
            onChange={(e) => set("main_issue_explanation", e.target.value)}
            placeholder="Ví dụ: Mã PT: Bạn đã đưa ra dẫn chứng nhưng chưa phân tích ý nghĩa của dẫn chứng đối với luận điểm."
          />
        </Field>
      </div>

      <Field label="3. GỢI Ý ĐIỀU CHỈNH" hint="Đề xuất cách sửa cụ thể, khả thi." error={errors.suggestion} required>
        <Textarea
          rows={3}
          value={value.suggestion}
          disabled={disabled}
          invalid={!!errors.suggestion}
          onChange={(e) => set("suggestion", e.target.value)}
          placeholder="Ví dụ: Sau dẫn chứng, bạn nên bổ sung một hoặc hai câu giải thích tác động của sự việc, từ đó làm rõ luận điểm."
        />
      </Field>

      {onCheck && !disabled && (
        <div className="space-y-2 rounded-lg border border-dashed border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">AI chỉ kiểm tra tính đầy đủ, lịch sự và cụ thể của phản hồi. AI không viết thay nhận xét của bạn.</p>
            <Button type="button" variant="secondary" onClick={onCheck} loading={checking}>
              Kiểm tra phản hồi
            </Button>
          </div>
          {check && (
            <Alert tone={check.complete && check.polite && check.specific ? "ok" : "warn"}>
              <div className="flex flex-wrap gap-2">
                <Badge tone={check.complete ? "ok" : "warn"}>{check.complete ? "Đầy đủ" : "Chưa đầy đủ"}</Badge>
                <Badge tone={check.polite ? "ok" : "warn"}>{check.polite ? "Lịch sự" : "Cần nhẹ nhàng hơn"}</Badge>
                <Badge tone={check.specific ? "ok" : "warn"}>{check.specific ? "Cụ thể" : "Chưa cụ thể"}</Badge>
                <span className="text-xs text-muted">({check.source === "ai" ? "AI" : "kiểm tra theo quy tắc"})</span>
              </div>
              {check.comments.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {check.comments.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
