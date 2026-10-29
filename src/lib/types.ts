import type { CriterionId, Level } from "./rubric";

export type Role = "teacher" | "student";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  class_name: string | null;
  email: string | null;
  created_at: string;
}

export interface SolutionItem {
  id: string;
  text: string;
}

export interface SolutionGroup {
  id: string;
  label: string;
  items: SolutionItem[];
}

/** Đề bài. Giáo viên phải xác nhận yêu cầu nội dung trước khi AI chấm. */
export interface PromptRow {
  id: string;
  title: string;
  content: string;
  issue_statement: string;
  solution_groups: SolutionGroup[];
  grading_guide: string;
  rubric_version: string;
  confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_by: string;
  created_at: string;
}

export type PairingMode = "pairs" | "rotation" | "groups" | "manual";

/** Đợt đánh giá đồng đẳng. */
export interface Round {
  id: string;
  title: string;
  prompt_id: string;
  rubric_version: string;
  deadline: string | null;
  rubric_published: boolean;
  ai_visible: boolean;
  status: "draft" | "open" | "closed";
  pairing_mode: PairingMode | null;
  created_by: string;
  created_at: string;
}

export interface Essay {
  id: string;
  round_id: string;
  prompt_id: string;
  author_id: string;
  created_at: string;
}

export interface EssayVersion {
  id: string;
  essay_id: string;
  version_no: number;
  kind: "original" | "revision";
  status: "draft" | "final";
  content: string;
  word_count: number;
  parent_version_id: string | null;
  created_at: string;
  submitted_at: string | null;
}

export interface Assignment {
  id: string;
  round_id: string;
  writer_id: string;
  reviewer_id: string;
  group_label: string | null;
  /** Phiên bản bài viết được đánh giá; gắn khi người đánh giá bắt đầu. */
  essay_version_id: string | null;
  status: "assigned" | "in_progress" | "submitted";
  created_at: string;
}

export interface CriterionScore {
  criterion_id: CriterionId;
  level: Level | null;
  score: number | null;
  error_codes: string[];
  evidence: string;
  explanation: string;
}

export interface FeedbackCheck {
  complete: boolean;
  polite: boolean;
  specific: boolean;
  comments: string[];
  source: "ai" | "rules";
  checked_at: string;
}

export interface PeerReview {
  id: string;
  assignment_id: string;
  essay_version_id: string;
  rubric_version: string;
  criteria: CriterionScore[];
  total: number | null;
  primary_error_code: string | null;
  highlight: string;
  main_issue_evidence: string;
  main_issue_explanation: string;
  suggestion: string;
  feedback_check: FeedbackCheck | null;
  status: "draft" | "submitted";
  updated_at: string;
  submitted_at: string | null;
}

export type Acceptance = "full" | "partial" | "discuss";
export type PlannedAction = "reasoning_evidence" | "structure_language" | "keep_position";

export const ACCEPTANCE_LABELS: Record<Acceptance, string> = {
  full: "Đồng ý hoàn toàn",
  partial: "Đồng ý một phần",
  discuss: "Cần trao đổi thêm",
};

export const PLANNED_ACTION_LABELS: Record<PlannedAction, string> = {
  reasoning_evidence: "Chỉnh sửa lí lẽ/dẫn chứng",
  structure_language: "Sửa lỗi cấu trúc/ngôn ngữ",
  keep_position: "Giữ nguyên lập trường",
};

export interface WriterResponse {
  id: string;
  assignment_id: string;
  acceptance: Acceptance | null;
  planned_actions: PlannedAction[];
  explanation: string;
  revised_version_id: string | null;
  status: "draft" | "submitted";
  updated_at: string;
}

export interface AIErrorFinding {
  code: string;
  criterion_id: CriterionId;
  quote: string;
  location: string;
  reason: string;
  fix: string;
  quote_verified?: boolean;
}

export interface AIStyleSuggestion {
  quote: string;
  suggestion: string;
  quote_verified?: boolean;
}

export interface AICriterionResult {
  criterion_id: CriterionId;
  level: Level;
  score: number;
  evidence: string[];
  rationale: string;
}

export interface AIGradingResult {
  criteria: AICriterionResult[];
  total: number;
  strengths: string[];
  weaknesses: string[];
  errors: AIErrorFinding[];
  style_suggestions: AIStyleSuggestion[];
  reference_paragraph: string;
  practice_prompts: string[];
}

export interface AIGrading {
  id: string;
  essay_version_id: string;
  prompt_id: string;
  rubric_version: string;
  result: AIGradingResult;
  total: number;
  model: string;
  created_at: string;
}

export interface TeacherGrading {
  id: string;
  essay_version_id: string;
  rubric_version: string;
  criteria: CriterionScore[];
  total: number;
  graded_by: string;
  updated_at: string;
}

export interface RubricConfirmation {
  id: string;
  rubric_version: string;
  confirmed_by: string;
  confirmed_at: string;
  notes: string;
}
