import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { ERROR_CODES, isValidCode } from "../error-codes";
import { RUBRIC_2026, renderDescription, LEVEL_NAMES, type CriterionId, type Level, type Rubric } from "../rubric";
import { scoreForLevel, sumScores } from "../scoring";
import { quoteInText, countWords, countParagraphs } from "../text";
import type { AIGradingResult, FeedbackCheck, PromptRow } from "../types";
import { ApiError } from "./http";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export const isAIConfigured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
function getClient() {
  if (!isAIConfigured()) throw new ApiError(503, "Chưa cấu hình ANTHROPIC_API_KEY nên chưa thể dùng AI.");
  client ??= new Anthropic();
  return client;
}

const CRITERION_IDS = ["van_de", "giai_phap", "lap_luan", "hinh_thuc"] as const;
const CODES = ERROR_CODES.map((e) => e.code) as [string, ...string[]];

const GradingSchema = z.object({
  criteria: z.array(
    z.object({
      criterion_id: z.enum(CRITERION_IDS),
      level: z.number().int().describe("Mức 4, 3, 2 hoặc 1 theo rubric"),
      evidence: z.array(z.string()).describe("Trích dẫn nguyên văn từ bài làm làm căn cứ"),
      rationale: z.string().describe("Lí do chọn mức, đối chiếu mô tả mức trong rubric"),
    }),
  ),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  errors: z.array(
    z.object({
      code: z.enum(CODES),
      criterion_id: z.enum(CRITERION_IDS),
      quote: z.string().describe("Trích nguyên văn đoạn có lỗi, chép đúng từng chữ trong bài"),
      location: z.string().describe("Vị trí, ví dụ: câu 3"),
      reason: z.string().describe("Vì sao đây là lỗi"),
      fix: z.string().describe("Cách sửa cụ thể"),
    }),
  ),
  style_suggestions: z.array(
    z.object({
      quote: z.string().describe("Trích nguyên văn"),
      suggestion: z.string().describe("Gợi ý nâng cao diễn đạt, không phải lỗi"),
    }),
  ),
  reference_paragraph: z.string().describe("Đoạn văn tham khảo khoảng 200 chữ"),
  practice_prompts: z.array(z.string()).describe("Đúng 3 đề luyện tập"),
});

function rubricText(rubric: Rubric, prompt: PromptRow) {
  const lines: string[] = [];
  for (const c of rubric.criteria) {
    lines.push(`## Tiêu chí ${c.order} [${c.id}] ${c.name} — tối đa ${c.maxScore} điểm (${c.rubricName})`);
    for (const l of c.levels) {
      lines.push(`- Mức ${l.level} (${LEVEL_NAMES[l.level]}, ${l.score} điểm): ${l.description.map((d) => renderDescription(d, prompt.issue_statement)).join(" ")}`);
    }
    for (const n of c.sourceNotes) lines.push(`  Ghi chú: ${n}`);
  }
  return lines.join("\n");
}

function promptRequirements(prompt: PromptRow) {
  const groups = prompt.solution_groups
    .map((g) => `- ${g.label}:\n${g.items.map((i) => `  - Ý ${i.id}: ${i.text}`).join("\n")}`)
    .join("\n");
  return [
    `Đề bài: ${prompt.content}`,
    `Vấn đề nghị luận (giáo viên đã xác nhận): ${prompt.issue_statement}`,
    `Yêu cầu nội dung cụ thể (giáo viên đã xác nhận, dùng để chấm tiêu chí 2):\n${groups || "(không có nhóm ý)"}`,
    prompt.grading_guide ? `Hướng dẫn chấm bổ sung của giáo viên:\n${prompt.grading_guide}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const codeTable = ERROR_CODES.map((e) => `- ${e.code} (tiêu chí ${e.criterionId}): ${e.name}. ${e.explanation}`).join("\n");

const GRADING_SYSTEM = `Bạn là giám khảo môn Ngữ văn, chấm đoạn văn nghị luận xã hội khoảng 200 chữ của học sinh THPT Việt Nam.
Bạn chấm độc lập, chỉ căn cứ rubric và yêu cầu nội dung của đề mà giáo viên đã xác nhận. Không dùng các ý giải pháp của đề thi mẫu khác để chấm đề này.

Cách làm:
- Với mỗi tiêu chí, chọn đúng một mức (4, 3, 2, 1) có mô tả khớp nhất với bài làm. Không tự đặt điểm: hệ thống sẽ lấy điểm theo mức trong rubric.
- Với tiêu chí 2, đếm số ý trong từng nhóm ý mà bài làm thực sự nêu được, rồi đối chiếu bảng mức. Nếu trường hợp không có trong rubric, chọn mức gần nhất và nói rõ trong rationale.
- Mọi bằng chứng, lỗi dùng từ, đặt câu, chính tả, liên kết, hành văn phải kèm trích dẫn chép nguyên văn từng chữ từ bài làm (không sửa chính tả trong trích dẫn).
- Chỉ dùng các mã lỗi trong bảng mã. Mỗi lỗi gắn đúng tiêu chí của mã đó.
- Phân biệt: "errors" là lỗi thuộc mã chẩn đoán; "style_suggestions" là gợi ý nâng cao chất lượng diễn đạt, không phải lỗi.
- Ưu điểm và hạn chế viết ngắn gọn, cụ thể, giọng tôn trọng học sinh.
- reference_paragraph: một đoạn văn tham khảo khoảng 200 chữ cho chính đề này, viết mới hoàn toàn, không chép lại bài học sinh, đúng hình thức một đoạn văn.
- practice_prompts: đúng 3 đề nghị luận xã hội 200 chữ giúp học sinh luyện khắc phục các hạn chế đã nêu.

Bảng mã lỗi:
${codeTable}`;

/** AI chấm độc lập một bài viết. Điểm được tính lại từ mức theo rubric; trích dẫn được kiểm tra với bài gốc. */
export async function gradeEssay(prompt: PromptRow, essay: string, rubric: Rubric = RUBRIC_2026): Promise<AIGradingResult> {
  const anthropic = getClient();
  const user = `# RUBRIC\n${rubricText(rubric, prompt)}\n\n# YÊU CẦU CỦA ĐỀ\n${promptRequirements(prompt)}\n\n# THÔNG TIN HÌNH THỨC (đếm tự động)\nSố chữ: ${countWords(essay)}. Số đoạn: ${countParagraphs(essay)}.\n\n# BÀI LÀM CỦA HỌC SINH\n<bai_lam>\n${essay}\n</bai_lam>`;

  let response;
  try {
    response = await anthropic.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(GradingSchema) },
      system: GRADING_SYSTEM,
      messages: [{ role: "user", content: user }],
    });
  } catch (err) {
    throw toApiError(err);
  }
  if (response.stop_reason === "refusal") throw new ApiError(502, "AI từ chối chấm bài này. Vui lòng để giáo viên chấm.");
  if (response.stop_reason === "max_tokens") throw new ApiError(502, "Kết quả AI bị cắt ngang. Vui lòng thử lại.");
  const parsed = response.parsed_output;
  if (!parsed) throw new ApiError(502, "Không đọc được kết quả AI. Vui lòng thử lại.");
  return postProcess(parsed, essay, rubric);
}

export function postProcess(parsed: z.infer<typeof GradingSchema>, essay: string, rubric: Rubric = RUBRIC_2026): AIGradingResult {
  const criteria = rubric.criteria.map((c) => {
    const row = parsed.criteria.find((x) => x.criterion_id === c.id);
    const level = (row && [1, 2, 3, 4].includes(row.level) ? row.level : 1) as Level;
    return {
      criterion_id: c.id as CriterionId,
      level,
      score: scoreForLevel(c.id, level, rubric),
      evidence: (row?.evidence ?? []).filter((q) => quoteInText(q, essay)),
      rationale: row?.rationale ?? "AI không trả về nhận xét cho tiêu chí này.",
    };
  });
  return {
    criteria,
    total: sumScores(criteria.map((c) => c.score)),
    strengths: parsed.strengths,
    weaknesses: parsed.weaknesses,
    errors: parsed.errors
      .filter((e) => isValidCode(e.code, e.criterion_id))
      .map((e) => ({ ...e, quote_verified: quoteInText(e.quote, essay) })),
    style_suggestions: parsed.style_suggestions.map((s) => ({ ...s, quote_verified: quoteInText(s.quote, essay) })),
    reference_paragraph: parsed.reference_paragraph,
    practice_prompts: parsed.practice_prompts.slice(0, 3),
  };
}

// ---------------------------------------------------------------- Kiểm tra phản hồi đồng đẳng

const FeedbackSchema = z.object({
  complete: z.boolean(),
  polite: z.boolean(),
  specific: z.boolean(),
  comments: z.array(z.string()).describe("Tối đa 3 câu hỏi gợi mở; không viết lại nhận xét thay học sinh"),
});

export interface FeedbackInput {
  highlight: string;
  primary_error_code: string | null;
  main_issue_evidence: string;
  main_issue_explanation: string;
  suggestion: string;
}

const RUDE = ["ngu", "dốt", "dở tệ", "vớ vẩn", "nhảm", "rác", "kém cỏi", "chán"];

/** Kiểm tra bằng quy tắc khi chưa cấu hình AI. */
export function ruleFeedbackCheck(fb: FeedbackInput): FeedbackCheck {
  const comments: string[] = [];
  const complete =
    fb.highlight.trim().length >= 15 && fb.suggestion.trim().length >= 20 && fb.main_issue_explanation.trim().length >= 15;
  if (!complete) comments.push("Bạn đã điền đủ ba phần: điểm sáng, lỗi chính, gợi ý điều chỉnh chưa?");
  const all = `${fb.highlight} ${fb.main_issue_explanation} ${fb.suggestion}`.toLowerCase();
  const polite = !RUDE.some((w) => new RegExp(`(^|\\s)${w}(\\s|$|[.,!?])`, "u").test(all));
  if (!polite) comments.push("Có từ ngữ có thể làm bạn mình tổn thương. Bạn có thể diễn đạt nhẹ nhàng, tôn trọng hơn không?");
  const specific = fb.main_issue_evidence.trim().length >= 5 && /câu|dẫn chứng|lí lẽ|từ|“|"|nên|bổ sung|thay/u.test(fb.suggestion);
  if (!specific) comments.push("Gợi ý đã chỉ rõ sửa ở câu nào, sửa như thế nào chưa?");
  return { complete, polite, specific, comments, source: "rules", checked_at: new Date().toISOString() };
}

export async function checkFeedback(essay: string, fb: FeedbackInput): Promise<FeedbackCheck> {
  if (!isAIConfigured()) return ruleFeedbackCheck(fb);
  const anthropic = getClient();
  const content = `Bài viết của bạn học:\n<bai_lam>\n${essay}\n</bai_lam>\n\nPhản hồi của người đánh giá:\n1. Điểm sáng nổi bật: ${fb.highlight}\n2. Lỗi gãy lập luận chính: mã ${fb.primary_error_code ?? "(không chọn)"}; biểu hiện: ${fb.main_issue_evidence}; giải thích: ${fb.main_issue_explanation}\n3. Gợi ý điều chỉnh: ${fb.suggestion}`;
  try {
    const response = await anthropic.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(FeedbackSchema) },
      system:
        "Bạn hỗ trợ học sinh THPT viết phản hồi đánh giá đồng đẳng. Đánh giá phản hồi theo ba tiêu chí: complete (đủ ba phần: có ưu điểm thực sự, có lỗi chính kèm biểu hiện và giải thích, có gợi ý), polite (lịch sự, tôn trọng), specific (cụ thể, có căn cứ trong bài, gợi ý khả thi). Trong comments, chỉ đặt tối đa 3 câu hỏi gợi mở để học sinh tự hoàn thiện. Tuyệt đối không viết lại hay viết hộ nhận xét.",
      messages: [{ role: "user", content }],
    });
    const p = response.parsed_output;
    if (response.stop_reason === "refusal" || !p) return ruleFeedbackCheck(fb);
    return { ...p, comments: p.comments.slice(0, 3), source: "ai", checked_at: new Date().toISOString() };
  } catch (err) {
    console.error("checkFeedback", err);
    return ruleFeedbackCheck(fb);
  }
}

function toApiError(err: unknown): ApiError {
  if (err instanceof Anthropic.AuthenticationError) return new ApiError(503, "Khóa API của Claude không hợp lệ.");
  if (err instanceof Anthropic.RateLimitError) return new ApiError(429, "AI đang quá tải, vui lòng thử lại sau ít phút.");
  if (err instanceof Anthropic.BadRequestError) return new ApiError(502, `Yêu cầu gửi AI không hợp lệ: ${err.message}`);
  if (err instanceof Anthropic.APIConnectionError) return new ApiError(502, "Không kết nối được dịch vụ AI.");
  if (err instanceof Anthropic.APIError) return new ApiError(502, `Lỗi dịch vụ AI (${err.status}).`);
  return new ApiError(500, err instanceof Error ? err.message : "Lỗi AI không xác định.");
}
