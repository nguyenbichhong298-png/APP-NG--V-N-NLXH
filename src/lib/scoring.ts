import { ERROR_CODE_MAP, isValidCode } from "./error-codes";
import { getCriterion, RUBRIC_2026, type CriterionId, type Level, type Rubric } from "./rubric";
import type { CriterionScore } from "./types";

/** Điểm tương ứng với mức — lấy trực tiếp từ rubric, không quy đổi. */
export function scoreForLevel(criterionId: CriterionId, level: Level, rubric: Rubric = RUBRIC_2026): number {
  const l = getCriterion(criterionId, rubric).levels.find((x) => x.level === level);
  if (!l) throw new Error(`Mức ${level} không có trong tiêu chí ${criterionId}`);
  return l.score;
}

/** Cộng điểm theo đơn vị 0,01 để tránh sai số dấu phẩy động. */
export function sumScores(scores: (number | null | undefined)[]): number {
  return Math.round(scores.reduce<number>((s, x) => s + Math.round((x ?? 0) * 100), 0)) / 100;
}

export function formatScore(n: number | null | undefined): string {
  if (n === null || n === undefined) return "…";
  return n.toFixed(2).replace(".", ",");
}

export function emptyCriteria(rubric: Rubric = RUBRIC_2026): CriterionScore[] {
  return rubric.criteria.map((c) => ({
    criterion_id: c.id,
    level: null,
    score: null,
    error_codes: [],
    evidence: "",
    explanation: "",
  }));
}

/** Gán lại điểm theo mức (không tin điểm do client gửi lên) và lọc mã lỗi không hợp lệ. */
export function normalizeCriteria(
  input: (Omit<CriterionScore, "score"> & { score?: number | null })[],
  rubric: Rubric = RUBRIC_2026,
): CriterionScore[] {
  return rubric.criteria.map((c) => {
    const row = input.find((x) => x.criterion_id === c.id);
    const level = row?.level ?? null;
    return {
      criterion_id: c.id,
      level,
      score: level ? scoreForLevel(c.id, level, rubric) : null,
      error_codes: [...new Set((row?.error_codes ?? []).filter((code) => isValidCode(code, c.id)))],
      evidence: (row?.evidence ?? "").trim(),
      explanation: (row?.explanation ?? "").trim(),
    };
  });
}

export function totalOf(criteria: CriterionScore[]): number | null {
  if (criteria.some((c) => c.score === null)) return null;
  return sumScores(criteria.map((c) => c.score));
}

export interface ThreeStep {
  highlight: string;
  primary_error_code: string | null;
  main_issue_evidence: string;
  main_issue_explanation: string;
  suggestion: string;
}

export type FieldErrors = Record<string, string>;

/**
 * Kiểm tra phiếu chấm trước khi nộp.
 * - Mọi tiêu chí phải chọn mức.
 * - Tiêu chí chưa đạt điểm tối đa: phải chọn mã lỗi hoặc giải thích nguyên nhân.
 * - Có mã lỗi thì phải xác định một lỗi chính nằm trong các mã đã chọn.
 * - Ba ô phản hồi bắt buộc.
 */
export function validatePeerReview(criteria: CriterionScore[], fb: ThreeStep, rubric: Rubric = RUBRIC_2026): FieldErrors {
  const errors: FieldErrors = {};
  const normalized = normalizeCriteria(criteria, rubric);
  for (const c of rubric.criteria) {
    const row = normalized.find((x) => x.criterion_id === c.id)!;
    if (!row.level) {
      errors[`criteria.${c.id}.level`] = `Chọn mức đánh giá cho tiêu chí “${c.name}”.`;
      continue;
    }
    if ((row.score ?? 0) < c.maxScore && row.error_codes.length === 0 && row.explanation.length < 10) {
      errors[`criteria.${c.id}.codes`] =
        `Tiêu chí “${c.name}” chưa đạt điểm tối đa: hãy chọn mã lỗi hoặc giải thích nguyên nhân (ít nhất 10 kí tự).`;
    }
  }
  const selected = normalized.flatMap((c) => c.error_codes);
  if (selected.length > 0) {
    if (!fb.primary_error_code) errors.primary_error_code = "Xác định một lỗi chính trong các mã lỗi đã chọn.";
    else if (!selected.includes(fb.primary_error_code))
      errors.primary_error_code = "Lỗi chính phải là một trong các mã lỗi đã tích chọn ở bảng điểm.";
  } else if (fb.primary_error_code && !ERROR_CODE_MAP[fb.primary_error_code]) {
    errors.primary_error_code = "Mã lỗi chính không hợp lệ.";
  }
  if (fb.highlight.trim().length < 15) errors.highlight = "Ghi nhận ít nhất một ưu điểm thực sự của bài viết (tối thiểu 15 kí tự).";
  if (fb.primary_error_code) {
    if (fb.main_issue_evidence.trim().length < 5) errors.main_issue_evidence = "Trích dẫn biểu hiện của lỗi chính trong bài.";
    if (fb.main_issue_explanation.trim().length < 15)
      errors.main_issue_explanation = "Giải thích ngắn vì sao cần cải thiện (tối thiểu 15 kí tự).";
  } else if (selected.length === 0 && fb.main_issue_explanation.trim().length < 15) {
    errors.main_issue_explanation = "Nếu không có lỗi, hãy nêu điều bài viết có thể làm tốt hơn (tối thiểu 15 kí tự).";
  }
  if (fb.suggestion.trim().length < 20) errors.suggestion = "Đề xuất cách sửa cụ thể, khả thi (tối thiểu 20 kí tự).";
  return errors;
}

/**
 * Gợi ý mức tiêu chí 2 từ số ý nêu được trong nhóm ý 1 (n1) và nhóm ý 2 (n2), theo đúng bảng gốc.
 * Trả về null khi Rubric gốc không quy định trường hợp đó — giáo viên quyết định.
 */
export function suggestSolutionLevel(n1: number, n2: number): Level | null {
  if (n1 >= 3 && n2 >= 1) return 4;
  if (n1 === 2 && n2 >= 1) return 3;
  if ((n1 === 1 && n2 >= 1) || (n1 >= 3 && n2 === 0) || (n1 === 0 && n2 >= 3)) return 2;
  if ((n1 === 1 && n2 === 0) || (n1 === 0 && (n2 === 1 || n2 === 2))) return 1;
  return null;
}
