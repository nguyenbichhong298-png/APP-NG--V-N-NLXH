import "server-only";
import { z } from "zod";
import { generatePairs, validateManualPairs, type Pair } from "../pairing";
import { ISSUE_2026, RUBRIC_2026 } from "../rubric";
import { emptyCriteria, normalizeCriteria, totalOf, validatePeerReview } from "../scoring";
import { computeRoundStats, referenceFromCriteria, type ReferenceGrading } from "../stats";
import { countWords } from "../text";
import type {
  AIGrading,
  Assignment,
  EssayVersion,
  PeerReview,
  Profile,
  PromptRow,
  Round,
  TeacherGrading,
  WriterResponse,
} from "../types";
import { checkFeedback, gradeEssay, AI_MODEL, isAIConfigured } from "./ai";
import { getDb, now } from "./db";
import { ApiError, badRequest, forbidden, notFound } from "./http";

const db = () => getDb();
const rubric = RUBRIC_2026;

// ================================================================ Lược đồ dữ liệu vào

const CriterionScoreIn = z.object({
  criterion_id: z.enum(["van_de", "giai_phap", "lap_luan", "hinh_thuc"]),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
  score: z.number().nullable().optional(),
  error_codes: z.array(z.string()).max(11),
  evidence: z.string().max(2000),
  explanation: z.string().max(2000),
});

export const ReviewIn = z.object({
  criteria: z.array(CriterionScoreIn).max(4),
  primary_error_code: z.string().nullable(),
  highlight: z.string().max(3000),
  main_issue_evidence: z.string().max(3000),
  main_issue_explanation: z.string().max(3000),
  suggestion: z.string().max(3000),
  submit: z.boolean(),
});

export const WriterResponseIn = z.object({
  acceptance: z.enum(["full", "partial", "discuss"]).nullable(),
  planned_actions: z.array(z.enum(["reasoning_evidence", "structure_language", "keep_position"])).max(3),
  explanation: z.string().max(3000),
  submit: z.boolean(),
});

export const PromptIn = z.object({
  title: z.string().trim().min(3, "Tên đề tối thiểu 3 kí tự.").max(200),
  content: z.string().trim().min(10, "Nội dung đề tối thiểu 10 kí tự.").max(3000),
  issue_statement: z.string().trim().min(10, "Hãy nêu vấn đề nghị luận.").max(1000),
  solution_groups: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        items: z.array(z.object({ id: z.string().min(1), text: z.string().trim().min(1, "Nhập nội dung ý.") })).max(10),
      }),
    )
    .max(5),
  grading_guide: z.string().max(5000),
});

export const RoundIn = z.object({
  title: z.string().trim().min(3, "Tên đợt tối thiểu 3 kí tự.").max(200),
  prompt_id: z.string().min(1, "Chọn đề bài."),
  deadline: z.string().nullable(),
});

export const RoundPatch = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  deadline: z.string().nullable().optional(),
  rubric_published: z.boolean().optional(),
  ai_visible: z.boolean().optional(),
  status: z.enum(["draft", "open", "closed"]).optional(),
});

export const PairingIn = z.object({
  mode: z.enum(["pairs", "rotation", "groups", "manual"]),
  student_ids: z.array(z.string()).max(200),
  group_size: z.number().int().min(2).max(6).optional(),
  manual: z.array(z.object({ writerId: z.string(), reviewerId: z.string(), group: z.string().nullable() })).optional(),
  only_submitted: z.boolean().optional(),
});

// ================================================================ Tiện ích

async function nameMap(ids: string[]) {
  const profiles = ids.length ? await db().list("profiles", { id: [...new Set(ids)] }) : [];
  return Object.fromEntries(profiles.map((p) => [p.id, p.full_name])) as Record<string, string>;
}

async function mustGet<N extends Parameters<ReturnType<typeof getDb>["get"]>[0]>(table: N, id: string, what: string) {
  const row = await db().get(table, id);
  if (!row) throw notFound(`Không tìm thấy ${what}.`);
  return row;
}

function isPastDeadline(round: Round) {
  return !!round.deadline && new Date(round.deadline).getTime() < Date.now();
}

async function latestFinalOriginal(roundId: string, authorId: string): Promise<EssayVersion | null> {
  const [essay] = await db().list("essays", { round_id: roundId, author_id: authorId });
  if (!essay) return null;
  const versions = await db().list("essay_versions", { essay_id: essay.id, kind: "original", status: "final" });
  return versions.sort((a, b) => b.version_no - a.version_no)[0] ?? null;
}

async function hasPendingReviews(userId: string, roundId: string) {
  const pending = await db().list("assignments", { round_id: roundId, reviewer_id: userId, status: ["assigned", "in_progress"] });
  return pending.length > 0;
}

async function latestAIGrading(versionId: string): Promise<AIGrading | null> {
  const list = await db().list("ai_gradings", { essay_version_id: versionId });
  return list.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

// ================================================================ Rubric

export async function getRubricInfo() {
  const confirmations = await db().list("rubric_confirmations", { rubric_version: rubric.version });
  const last = confirmations.sort((a, b) => b.confirmed_at.localeCompare(a.confirmed_at))[0] ?? null;
  return { rubric, confirmation: last };
}

export async function confirmRubric(user: Profile, notes: string) {
  return db().insert("rubric_confirmations", {
    rubric_version: rubric.version,
    confirmed_by: user.id,
    confirmed_at: now(),
    notes: notes.slice(0, 3000),
  });
}

// ================================================================ Đề bài

export async function listPrompts() {
  const prompts = await db().list("prompts");
  return prompts.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createPrompt(user: Profile, input: z.infer<typeof PromptIn>) {
  return db().insert("prompts", {
    ...input,
    rubric_version: rubric.version,
    confirmed: false,
    confirmed_by: null,
    confirmed_at: null,
    created_by: user.id,
    created_at: now(),
  });
}

export async function updatePrompt(id: string, input: z.infer<typeof PromptIn>) {
  await mustGet("prompts", id, "đề bài");
  // Sửa yêu cầu nội dung thì phải xác nhận lại.
  return db().update("prompts", id, { ...input, confirmed: false, confirmed_by: null, confirmed_at: null });
}

export async function confirmPrompt(user: Profile, id: string) {
  const p = await mustGet("prompts", id, "đề bài");
  const itemCount = p.solution_groups.reduce((n, g) => n + g.items.length, 0);
  if (!p.issue_statement.trim() || itemCount === 0)
    throw badRequest("Cần nhập vấn đề nghị luận và ít nhất một ý trong yêu cầu nội dung trước khi xác nhận.");
  return db().update("prompts", id, { confirmed: true, confirmed_by: user.id, confirmed_at: now() });
}

// ================================================================ Đợt đánh giá (giáo viên)

export async function listRounds() {
  const [rounds, prompts, assignments, reviews] = await Promise.all([
    db().list("rounds"),
    db().list("prompts"),
    db().list("assignments"),
    db().list("peer_reviews", { status: "submitted" }),
  ]);
  const submittedIds = new Set(reviews.map((r) => r.assignment_id));
  return rounds
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((r) => {
      const as = assignments.filter((a) => a.round_id === r.id);
      return {
        ...r,
        prompt_title: prompts.find((p) => p.id === r.prompt_id)?.title ?? "",
        assignment_count: as.length,
        submitted_count: as.filter((a) => submittedIds.has(a.id)).length,
      };
    });
}

export async function createRound(user: Profile, input: z.infer<typeof RoundIn>) {
  await mustGet("prompts", input.prompt_id, "đề bài");
  return db().insert("rounds", {
    title: input.title,
    prompt_id: input.prompt_id,
    deadline: input.deadline,
    rubric_version: rubric.version,
    rubric_published: false,
    ai_visible: false,
    status: "open",
    pairing_mode: null,
    created_by: user.id,
    created_at: now(),
  });
}

export async function patchRound(id: string, patch: z.infer<typeof RoundPatch>) {
  await mustGet("rounds", id, "đợt đánh giá");
  return db().update("rounds", id, patch);
}

export async function listStudents() {
  const students = await db().list("profiles", { role: "student" });
  return students.sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
}

export async function roundDetail(id: string) {
  const round = await mustGet("rounds", id, "đợt đánh giá");
  const [prompt, assignments, essays, students] = await Promise.all([
    db().get("prompts", round.prompt_id),
    db().list("assignments", { round_id: id }),
    db().list("essays", { round_id: id }),
    listStudents(),
  ]);
  const aIds = assignments.map((a) => a.id);
  const [reviews, responses, versions] = await Promise.all([
    aIds.length ? db().list("peer_reviews", { assignment_id: aIds }) : [],
    aIds.length ? db().list("writer_responses", { assignment_id: aIds }) : [],
    essays.length ? db().list("essay_versions", { essay_id: essays.map((e) => e.id) }) : [],
  ]);
  const vIds = versions.map((v) => v.id);
  const [aiGradings, teacherGradings] = await Promise.all([
    vIds.length ? db().list("ai_gradings", { essay_version_id: vIds }) : [],
    vIds.length ? db().list("teacher_gradings", { essay_version_id: vIds }) : [],
  ]);
  const names = Object.fromEntries(students.map((s) => [s.id, s.full_name]));
  const essayRows = essays.map((e) => {
    const vs = versions.filter((v) => v.essay_id === e.id).sort((a, b) => a.version_no - b.version_no);
    return {
      essay_id: e.id,
      author_id: e.author_id,
      author_name: names[e.author_id] ?? "?",
      versions: vs.map((v) => ({
        id: v.id,
        version_no: v.version_no,
        kind: v.kind,
        status: v.status,
        word_count: v.word_count,
        submitted_at: v.submitted_at,
        ai_total: aiGradings.filter((g) => g.essay_version_id === v.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.total ?? null,
        teacher_total: teacherGradings.find((g) => g.essay_version_id === v.id)?.total ?? null,
      })),
    };
  });
  return {
    round,
    prompt,
    students,
    essays: essayRows,
    assignments: assignments.map((a) => {
      const review = reviews.find((r) => r.assignment_id === a.id) ?? null;
      const response = responses.find((r) => r.assignment_id === a.id) ?? null;
      return {
        ...a,
        writer_name: names[a.writer_id] ?? "?",
        reviewer_name: names[a.reviewer_id] ?? "?",
        review_status: review?.status ?? null,
        review_total: review?.total ?? null,
        review_codes: review ? review.criteria.flatMap((c) => c.error_codes) : [],
        primary_error_code: review?.primary_error_code ?? null,
        response_status: response?.status ?? null,
        acceptance: response?.acceptance ?? null,
        planned_actions: response?.planned_actions ?? [],
        revised_version_id: response?.revised_version_id ?? null,
      };
    }),
  };
}

export async function setPairing(roundId: string, input: z.infer<typeof PairingIn>) {
  const round = await mustGet("rounds", roundId, "đợt đánh giá");
  const students = await listStudents();
  const valid = new Set(students.map((s) => s.id));
  let ids = input.student_ids.filter((i) => valid.has(i));
  if (input.only_submitted) {
    const essays = await db().list("essays", { round_id: roundId });
    const withFinal = new Set<string>();
    for (const e of essays) if (await latestFinalOriginal(roundId, e.author_id)) withFinal.add(e.author_id);
    ids = ids.filter((i) => withFinal.has(i));
  }
  let pairs: Pair[];
  if (input.mode === "manual") {
    pairs = (input.manual ?? []).filter((p) => valid.has(p.writerId) && valid.has(p.reviewerId));
    const err = validateManualPairs(pairs);
    if (err) throw badRequest(err);
  } else {
    pairs = generatePairs(ids, input.mode, input.group_size);
  }
  if (pairs.length === 0) throw badRequest("Cần ít nhất 2 học sinh để phân công đánh giá.");

  // Giữ nguyên các phân công đã có phiếu; chỉ thay các phân công chưa bắt đầu.
  const existing = await db().list("assignments", { round_id: roundId });
  const reviews = existing.length ? await db().list("peer_reviews", { assignment_id: existing.map((a) => a.id) }) : [];
  const started = new Set(reviews.map((r) => r.assignment_id));
  const kept = existing.filter((a) => started.has(a.id));
  for (const a of existing) if (!started.has(a.id)) await db().remove("assignments", a.id);
  const keptKeys = new Set(kept.map((a) => `${a.reviewer_id}>${a.writer_id}`));
  const created = await db().insertMany(
    "assignments",
    pairs
      .filter((p) => !keptKeys.has(`${p.reviewerId}>${p.writerId}`))
      .map((p) => ({
        round_id: roundId,
        writer_id: p.writerId,
        reviewer_id: p.reviewerId,
        group_label: p.group,
        essay_version_id: null,
        status: "assigned" as const,
        created_at: now(),
      })),
  );
  await db().update("rounds", round.id, { pairing_mode: input.mode });
  return { created: created.length, kept: kept.length };
}

export async function deleteAssignment(id: string) {
  const reviews = await db().list("peer_reviews", { assignment_id: id });
  if (reviews.length) throw badRequest("Phân công này đã có phiếu đánh giá, không thể xóa.");
  await db().remove("assignments", id);
}

// ================================================================ Học sinh: trang chủ và viết bài

export async function studentHome(user: Profile) {
  const [rounds, prompts, asReviewer, asWriter, essays] = await Promise.all([
    db().list("rounds", { status: ["open", "closed"] }),
    db().list("prompts"),
    db().list("assignments", { reviewer_id: user.id }),
    db().list("assignments", { writer_id: user.id }),
    db().list("essays", { author_id: user.id }),
  ]);
  const allA = [...asReviewer, ...asWriter];
  const [reviews, responses, versions] = await Promise.all([
    allA.length ? db().list("peer_reviews", { assignment_id: allA.map((a) => a.id) }) : [],
    asWriter.length ? db().list("writer_responses", { assignment_id: asWriter.map((a) => a.id) }) : [],
    essays.length ? db().list("essay_versions", { essay_id: essays.map((e) => e.id) }) : [],
  ]);
  const names = await nameMap(allA.flatMap((a) => [a.writer_id, a.reviewer_id]));
  return {
    user,
    rounds: rounds
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => {
        const essay = essays.find((e) => e.round_id === r.id);
        const vs = essay ? versions.filter((v) => v.essay_id === essay.id) : [];
        const original = vs.filter((v) => v.kind === "original").sort((a, b) => b.version_no - a.version_no)[0] ?? null;
        return {
          id: r.id,
          title: r.title,
          deadline: r.deadline,
          status: r.status,
          rubric_published: r.rubric_published,
          ai_visible: r.ai_visible,
          prompt_title: prompts.find((p) => p.id === r.prompt_id)?.title ?? "",
          essay_status: original?.status ?? null,
          original_version_id: original?.status === "final" ? original.id : null,
          reviews_to_do: asReviewer
            .filter((a) => a.round_id === r.id)
            .map((a) => ({
              id: a.id,
              writer_name: names[a.writer_id],
              status: reviews.find((x) => x.assignment_id === a.id)?.status ?? null,
            })),
          feedback_received: asWriter
            .filter((a) => a.round_id === r.id)
            .map((a) => {
              const rv = reviews.find((x) => x.assignment_id === a.id);
              return {
                id: a.id,
                reviewer_name: names[a.reviewer_id],
                review_submitted: rv?.status === "submitted",
                response_status: responses.find((x) => x.assignment_id === a.id)?.status ?? null,
              };
            }),
        };
      }),
  };
}

export async function getMyEssay(user: Profile, roundId: string) {
  const round = await mustGet("rounds", roundId, "đợt đánh giá");
  const prompt = await mustGet("prompts", round.prompt_id, "đề bài");
  const [essay] = await db().list("essays", { round_id: roundId, author_id: user.id });
  const versions = essay ? await db().list("essay_versions", { essay_id: essay.id }) : [];
  const original = versions.filter((v) => v.kind === "original").sort((a, b) => b.version_no - a.version_no)[0] ?? null;
  return { round, prompt: { id: prompt.id, title: prompt.title, content: prompt.content }, original };
}

export async function saveOriginalEssay(user: Profile, roundId: string, content: string, submit: boolean) {
  const round = await mustGet("rounds", roundId, "đợt đánh giá");
  if (round.status !== "open") throw badRequest("Đợt đánh giá đã đóng.");
  const text = content.trim();
  if (submit && countWords(text) < 30) throw badRequest("Bài viết quá ngắn để nộp (tối thiểu 30 chữ).");
  let [essay] = await db().list("essays", { round_id: roundId, author_id: user.id });
  essay ??= await db().insert("essays", { round_id: roundId, prompt_id: round.prompt_id, author_id: user.id, created_at: now() });
  const versions = await db().list("essay_versions", { essay_id: essay.id, kind: "original" });
  const current = versions.sort((a, b) => b.version_no - a.version_no)[0];
  if (current?.status === "final") throw badRequest("Bài viết đã nộp. Bạn sẽ chỉnh sửa ở bước 5 sau khi nhận góp ý.");
  const patch = { content: text, word_count: countWords(text), status: submit ? ("final" as const) : ("draft" as const), submitted_at: submit ? now() : null };
  const version = current
    ? await db().update("essay_versions", current.id, patch)
    : await db().insert("essay_versions", {
        essay_id: essay.id,
        version_no: 1,
        kind: "original",
        parent_version_id: null,
        created_at: now(),
        ...patch,
      });
  return version;
}

// ================================================================ Bước 2–4: người đánh giá

async function loadAssignment(id: string) {
  const a = await mustGet("assignments", id, "phân công");
  const round = await mustGet("rounds", a.round_id, "đợt đánh giá");
  const prompt = await mustGet("prompts", round.prompt_id, "đề bài");
  return { a, round, prompt };
}

export async function reviewerView(user: Profile, id: string) {
  const loaded = await loadAssignment(id);
  const { round, prompt } = loaded;
  let a = loaded.a;
  if (a.reviewer_id !== user.id && user.role !== "teacher") throw forbidden("Bài này không được phân công cho bạn.");
  if (!a.essay_version_id) {
    const v = await latestFinalOriginal(a.round_id, a.writer_id);
    if (v && a.reviewer_id === user.id) a = await db().update("assignments", a.id, { essay_version_id: v.id, status: "in_progress" });
  }
  const version = a.essay_version_id ? await db().get("essay_versions", a.essay_version_id) : null;
  const [review] = await db().list("peer_reviews", { assignment_id: a.id });
  const names = await nameMap([a.writer_id, a.reviewer_id]);
  // Không hiển thị điểm AI trước khi hoàn thành đánh giá đồng đẳng.
  const ai =
    review?.status === "submitted" && round.ai_visible && version ? await latestAIGrading(version.id) : null;
  return {
    assignment: a,
    round: { id: round.id, title: round.title, deadline: round.deadline, rubric_published: round.rubric_published, ai_visible: round.ai_visible, status: round.status },
    prompt: { id: prompt.id, title: prompt.title, content: prompt.content, issue_statement: prompt.issue_statement },
    writer_name: names[a.writer_id],
    reviewer_name: names[a.reviewer_id],
    version,
    review: review ?? null,
    ai,
    empty_criteria: emptyCriteria(rubric),
  };
}

export async function saveReview(user: Profile, id: string, input: z.infer<typeof ReviewIn>) {
  const { a, round } = await loadAssignment(id);
  if (a.reviewer_id !== user.id) throw forbidden("Chỉ người được phân công mới được chấm bài này.");
  if (!round.rubric_published) throw badRequest("Giáo viên chưa công khai rubric cho đợt này.");
  if (round.status !== "open") throw badRequest("Đợt đánh giá đã đóng.");
  if (input.submit && isPastDeadline(round)) throw badRequest("Đã quá thời hạn nộp phiếu.");
  if (!a.essay_version_id) throw badRequest("Bạn của bạn chưa nộp bài viết.");
  const [existing] = await db().list("peer_reviews", { assignment_id: a.id });
  if (existing?.status === "submitted") throw badRequest("Phiếu đã nộp, không thể sửa.");

  const criteria = normalizeCriteria(input.criteria, rubric);
  const fb = {
    highlight: input.highlight.trim(),
    primary_error_code: input.primary_error_code || null,
    main_issue_evidence: input.main_issue_evidence.trim(),
    main_issue_explanation: input.main_issue_explanation.trim(),
    suggestion: input.suggestion.trim(),
  };
  if (input.submit) {
    const fields = validatePeerReview(criteria, fb, rubric);
    if (Object.keys(fields).length) throw badRequest("Phiếu chưa đầy đủ. Vui lòng xem các mục được đánh dấu.", fields);
  }
  const row: Omit<PeerReview, "id"> = {
    assignment_id: a.id,
    essay_version_id: a.essay_version_id,
    rubric_version: rubric.version,
    criteria,
    total: totalOf(criteria),
    ...fb,
    feedback_check: existing?.feedback_check ?? null,
    status: input.submit ? "submitted" : "draft",
    updated_at: now(),
    submitted_at: input.submit ? now() : null,
  };
  const saved = existing ? await db().update("peer_reviews", existing.id, row) : await db().insert("peer_reviews", row);
  if (input.submit) await db().update("assignments", a.id, { status: "submitted" });
  return saved;
}

export async function runFeedbackCheck(user: Profile, id: string, input: z.infer<typeof ReviewIn>) {
  const { a } = await loadAssignment(id);
  if (a.reviewer_id !== user.id) throw forbidden();
  const version = a.essay_version_id ? await db().get("essay_versions", a.essay_version_id) : null;
  if (!version) throw badRequest("Chưa có bài viết để đối chiếu.");
  const check = await checkFeedback(version.content, input);
  const [existing] = await db().list("peer_reviews", { assignment_id: a.id });
  if (existing && existing.status === "draft") await db().update("peer_reviews", existing.id, { feedback_check: check });
  return check;
}

// ================================================================ Bước 5: người viết

export async function writerView(user: Profile, id: string) {
  const { a, round, prompt } = await loadAssignment(id);
  if (a.writer_id !== user.id && user.role !== "teacher") throw forbidden("Đây không phải bài viết của bạn.");
  const [review] = await db().list("peer_reviews", { assignment_id: a.id });
  if (!review || review.status !== "submitted") throw badRequest("Bạn đánh giá chưa nộp phiếu.");
  const original = await db().get("essay_versions", review.essay_version_id);
  const [response] = await db().list("writer_responses", { assignment_id: a.id });
  const revision = await findRevision(a, response ?? null);
  const names = await nameMap([a.writer_id, a.reviewer_id]);
  const showAI = user.role === "teacher" || (round.ai_visible && !(await hasPendingReviews(user.id, round.id)));
  const ai = showAI && original ? await latestAIGrading(original.id) : null;
  const aiRevision = showAI && revision?.status === "final" ? await latestAIGrading(revision.id) : null;
  return {
    assignment: a,
    round: { id: round.id, title: round.title, ai_visible: round.ai_visible, status: round.status },
    prompt: { id: prompt.id, title: prompt.title, content: prompt.content, issue_statement: prompt.issue_statement },
    writer_name: names[a.writer_id],
    reviewer_name: names[a.reviewer_id],
    original,
    review,
    response: response ?? null,
    revision,
    ai,
    ai_revision: aiRevision,
  };
}

async function findRevision(a: Assignment, response: WriterResponse | null): Promise<EssayVersion | null> {
  if (response?.revised_version_id) return db().get("essay_versions", response.revised_version_id);
  const [essay] = await db().list("essays", { round_id: a.round_id, author_id: a.writer_id });
  if (!essay) return null;
  const drafts = await db().list("essay_versions", { essay_id: essay.id, kind: "revision", status: "draft" });
  return drafts.sort((x, y) => y.version_no - x.version_no)[0] ?? null;
}

export async function saveWriterResponse(user: Profile, id: string, input: z.infer<typeof WriterResponseIn>) {
  const { a } = await loadAssignment(id);
  if (a.writer_id !== user.id) throw forbidden("Chỉ người viết mới được phản hồi.");
  const [review] = await db().list("peer_reviews", { assignment_id: a.id, status: "submitted" });
  if (!review) throw badRequest("Bạn đánh giá chưa nộp phiếu.");
  if (input.submit) {
    const fields: Record<string, string> = {};
    if (!input.acceptance) fields.acceptance = "Chọn mức độ tiếp nhận góp ý.";
    if (input.planned_actions.length === 0) fields.planned_actions = "Chọn ít nhất một dự kiến điều chỉnh.";
    if (input.acceptance && input.acceptance !== "full" && input.explanation.trim().length < 15)
      fields.explanation = "Hãy giải thích phần góp ý bạn chưa tiếp nhận hoặc cần trao đổi (tối thiểu 15 kí tự).";
    if (Object.keys(fields).length) throw badRequest("Phản hồi chưa đầy đủ.", fields);
  }
  const [existing] = await db().list("writer_responses", { assignment_id: a.id });
  const row = {
    assignment_id: a.id,
    acceptance: input.acceptance,
    planned_actions: [...new Set(input.planned_actions)],
    explanation: input.explanation.trim(),
    revised_version_id: existing?.revised_version_id ?? null,
    status: input.submit ? ("submitted" as const) : (existing?.status ?? ("draft" as const)),
    updated_at: now(),
  };
  return existing ? db().update("writer_responses", existing.id, row) : db().insert("writer_responses", row);
}

/** Lưu bản chỉnh sửa thành phiên bản độc lập; bài gốc giữ nguyên. */
export async function saveRevision(user: Profile, id: string, content: string, submit: boolean) {
  const { a, round } = await loadAssignment(id);
  if (a.writer_id !== user.id) throw forbidden("Chỉ người viết mới được chỉnh sửa bài.");
  if (round.status === "closed") throw badRequest("Đợt đánh giá đã đóng.");
  const [review] = await db().list("peer_reviews", { assignment_id: a.id, status: "submitted" });
  if (!review) throw badRequest("Bạn đánh giá chưa nộp phiếu.");
  const [response] = await db().list("writer_responses", { assignment_id: a.id });
  if (!response || response.status !== "submitted") throw badRequest("Hãy hoàn thành mục PHẢN HỒI TỪ NGƯỜI VIẾT trước khi chỉnh sửa.");
  const text = content.trim();
  if (submit && countWords(text) < 30) throw badRequest("Bản chỉnh sửa quá ngắn (tối thiểu 30 chữ).");
  const original = await mustGet("essay_versions", review.essay_version_id, "bài gốc");
  const current = await findRevision(a, response);
  if (current?.status === "final") throw badRequest("Bản chỉnh sửa đã nộp.");
  const all = await db().list("essay_versions", { essay_id: original.essay_id });
  const patch = { content: text, word_count: countWords(text), status: submit ? ("final" as const) : ("draft" as const), submitted_at: submit ? now() : null };
  const version = current
    ? await db().update("essay_versions", current.id, patch)
    : await db().insert("essay_versions", {
        essay_id: original.essay_id,
        version_no: Math.max(...all.map((v) => v.version_no)) + 1,
        kind: "revision",
        parent_version_id: original.id,
        created_at: now(),
        ...patch,
      });
  if (submit) await db().update("writer_responses", response.id, { revised_version_id: version.id, updated_at: now() });
  return version;
}

// ================================================================ AI chấm

async function canSeeVersion(user: Profile, version: EssayVersion) {
  if (user.role === "teacher") return { ok: true, author: false };
  const essay = await mustGet("essays", version.essay_id, "bài viết");
  return { ok: essay.author_id === user.id, author: essay.author_id === user.id };
}

export async function runAIGrading(versionId: string) {
  const version = await mustGet("essay_versions", versionId, "phiên bản bài viết");
  const essay = await mustGet("essays", version.essay_id, "bài viết");
  const prompt = await mustGet("prompts", essay.prompt_id, "đề bài");
  if (!prompt.confirmed)
    throw badRequest("Giáo viên chưa xác nhận yêu cầu nội dung và hướng dẫn chấm của đề này, nên AI chưa chấm.");
  if (version.status !== "final") throw badRequest("Chỉ chấm bài đã nộp.");
  const result = await gradeEssay(prompt, version.content, rubric);
  return db().insert("ai_gradings", {
    essay_version_id: version.id,
    prompt_id: prompt.id,
    rubric_version: rubric.version,
    result,
    total: result.total,
    model: AI_MODEL,
    created_at: now(),
  });
}

/** Chấm nền sau khi nộp; bỏ qua lặng lẽ nếu chưa cấu hình AI hoặc đề chưa xác nhận. */
export async function tryAutoGrade(versionId: string) {
  if (!isAIConfigured()) return;
  try {
    const version = await db().get("essay_versions", versionId);
    if (!version) return;
    const essay = await db().get("essays", version.essay_id);
    const prompt = essay ? await db().get("prompts", essay.prompt_id) : null;
    if (!prompt?.confirmed) return;
    await runAIGrading(versionId);
  } catch (err) {
    console.error("Tự động chấm AI thất bại", err);
  }
}

export async function requestAIGrading(user: Profile, versionId: string) {
  const version = await mustGet("essay_versions", versionId, "phiên bản bài viết");
  if (user.role !== "teacher") throw forbidden("Chỉ giáo viên được yêu cầu AI chấm lại.");
  return runAIGrading(version.id);
}

export async function getAIGrading(user: Profile, versionId: string) {
  const version = await mustGet("essay_versions", versionId, "phiên bản bài viết");
  const access = await canSeeVersion(user, version);
  if (!access.ok) throw forbidden();
  const essay = await mustGet("essays", version.essay_id, "bài viết");
  const round = await mustGet("rounds", essay.round_id, "đợt đánh giá");
  const prompt = await mustGet("prompts", essay.prompt_id, "đề bài");
  if (user.role !== "teacher") {
    if (!round.ai_visible) throw forbidden("Giáo viên chưa công bố kết quả AI.");
    // Học sinh vừa là người đánh giá phải nộp phiếu trước khi xem điểm AI của chính đợt này.
    if (await hasPendingReviews(user.id, round.id))
      throw forbidden("Hãy hoàn thành phiếu đánh giá đồng đẳng trước khi xem kết quả AI.");
  }
  return {
    version,
    prompt: { title: prompt.title, content: prompt.content, confirmed: prompt.confirmed },
    grading: await latestAIGrading(version.id),
    ai_configured: isAIConfigured(),
  };
}

// ================================================================ Giáo viên chấm (đối chiếu)

export const TeacherGradingIn = z.object({ criteria: z.array(CriterionScoreIn).max(4) });

export async function getTeacherGrading(versionId: string) {
  const version = await mustGet("essay_versions", versionId, "phiên bản bài viết");
  const essay = await mustGet("essays", version.essay_id, "bài viết");
  const [prompt, author, grading, ai] = await Promise.all([
    db().get("prompts", essay.prompt_id),
    db().get("profiles", essay.author_id),
    db().list("teacher_gradings", { essay_version_id: versionId }).then((x) => x[0] ?? null),
    latestAIGrading(versionId),
  ]);
  return { version, prompt, author_name: author?.full_name ?? "", grading, ai };
}

export async function saveTeacherGrading(user: Profile, versionId: string, input: z.infer<typeof TeacherGradingIn>) {
  await mustGet("essay_versions", versionId, "phiên bản bài viết");
  const criteria = normalizeCriteria(input.criteria, rubric);
  const total = totalOf(criteria);
  if (total === null) throw badRequest("Chọn mức cho đủ bốn tiêu chí.");
  const [existing] = await db().list("teacher_gradings", { essay_version_id: versionId });
  const row: Omit<TeacherGrading, "id"> = {
    essay_version_id: versionId,
    rubric_version: rubric.version,
    criteria,
    total,
    graded_by: user.id,
    updated_at: now(),
  };
  return existing ? db().update("teacher_gradings", existing.id, row) : db().insert("teacher_gradings", row);
}

// ================================================================ Báo cáo

export async function peerReport(user: Profile, id: string) {
  const { a, round, prompt } = await loadAssignment(id);
  const isTeacher = user.role === "teacher";
  if (!isTeacher && a.writer_id !== user.id && a.reviewer_id !== user.id) throw forbidden();
  const [review] = await db().list("peer_reviews", { assignment_id: a.id });
  if (!review) throw badRequest("Chưa có phiếu đánh giá.");
  if (!isTeacher && a.writer_id === user.id && review.status !== "submitted") throw badRequest("Phiếu chưa được nộp.");
  const [response] = await db().list("writer_responses", { assignment_id: a.id });
  const names = await nameMap([a.writer_id, a.reviewer_id]);
  const revised = response?.revised_version_id ? await db().get("essay_versions", response.revised_version_id) : null;
  return {
    assignment: a,
    round: { id: round.id, title: round.title },
    prompt: { title: prompt.title, content: prompt.content },
    writer_name: names[a.writer_id],
    reviewer_name: names[a.reviewer_id],
    review,
    response: response?.status === "submitted" ? response : null,
    revised_version: revised ? { id: revised.id, version_no: revised.version_no, submitted_at: revised.submitted_at } : null,
  };
}

export async function roundStats(roundId: string) {
  const detail = await roundDetail(roundId);
  const assignments = await db().list("assignments", { round_id: roundId });
  const aIds = assignments.map((a) => a.id);
  const [reviews, responses] = await Promise.all([
    aIds.length ? db().list("peer_reviews", { assignment_id: aIds }) : [],
    aIds.length ? db().list("writer_responses", { assignment_id: aIds }) : [],
  ]);
  const versionIds = detail.essays.flatMap((e) => e.versions.map((v) => v.id));
  const [teacher, ai] = await Promise.all([
    versionIds.length ? db().list("teacher_gradings", { essay_version_id: versionIds }) : [],
    versionIds.length ? db().list("ai_gradings", { essay_version_id: versionIds }) : [],
  ]);
  const references: Record<string, ReferenceGrading> = {};
  for (const vId of versionIds) {
    const t = teacher.find((g) => g.essay_version_id === vId);
    if (t) {
      references[vId] = referenceFromCriteria("teacher", t.criteria);
      continue;
    }
    const g = ai.filter((x) => x.essay_version_id === vId).sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
    if (g)
      references[vId] = {
        source: "ai",
        criteria: g.result.criteria.map((c) => ({ criterion_id: c.criterion_id, level: c.level, score: c.score })),
        codes: [...new Set(g.result.errors.map((e) => e.code))],
      };
  }
  const revisions = responses
    .filter((r) => r.revised_version_id)
    .map((r) => {
      const rv = reviews.find((x) => x.assignment_id === r.assignment_id);
      return rv ? { originalVersionId: rv.essay_version_id, revisedVersionId: r.revised_version_id! } : null;
    })
    .filter((x): x is { originalVersionId: string; revisedVersionId: string } => !!x);
  // Một bài gốc có thể có nhiều người đánh giá nhưng chỉ một bản sửa: loại trùng.
  const uniq = [...new Map(revisions.map((r) => [r.revisedVersionId, r])).values()];
  return { round: detail.round, stats: computeRoundStats({ assignments, reviews, responses, references, revisions: uniq }, rubric) };
}

export async function revisionCompare(user: Profile, versionId: string) {
  const revised = await mustGet("essay_versions", versionId, "bản chỉnh sửa");
  const access = await canSeeVersion(user, revised);
  if (!access.ok) throw forbidden();
  const original = revised.parent_version_id ? await db().get("essay_versions", revised.parent_version_id) : null;
  if (!original) throw notFound("Không tìm thấy bài gốc.");
  const essay = await mustGet("essays", revised.essay_id, "bài viết");
  const round = await mustGet("rounds", essay.round_id, "đợt đánh giá");
  const showAI = user.role === "teacher" || round.ai_visible;
  const [aiA, aiB, tA, tB] = await Promise.all([
    showAI ? latestAIGrading(original.id) : null,
    showAI ? latestAIGrading(revised.id) : null,
    user.role === "teacher" ? db().list("teacher_gradings", { essay_version_id: original.id }).then((x) => x[0] ?? null) : null,
    user.role === "teacher" ? db().list("teacher_gradings", { essay_version_id: revised.id }).then((x) => x[0] ?? null) : null,
  ]);
  return { original, revised, ai: { original: aiA, revised: aiB }, teacher: { original: tA, revised: tB } };
}

// ================================================================ Dữ liệu mẫu (chế độ thử nghiệm)

export async function ensureDemoSeed() {
  const profiles = await db().list("profiles");
  if (profiles.length) return profiles;
  const t = now();
  const people: Omit<Profile, "created_at">[] = [
    { id: "gv-01", full_name: "Cô Nguyễn Thu Hà", role: "teacher", class_name: null, email: "gv@demo.local" },
    ...["Trần Minh An", "Lê Bảo Châu", "Phạm Gia Huy", "Vũ Khánh Linh", "Đỗ Quang Minh", "Hoàng Ngọc Trâm"].map((n, i) => ({
      id: `hs-0${i + 1}`,
      full_name: n,
      role: "student" as const,
      class_name: "12A1",
      email: `hs${i + 1}@demo.local`,
    })),
  ];
  const created = await db().insertMany("profiles", people.map((p) => ({ ...p, created_at: t })));
  const prompt: Omit<PromptRow, "id"> = {
    title: "Đề thi tốt nghiệp THPT 2026 – Câu 1 phần Viết",
    content:
      "Viết đoạn văn nghị luận (khoảng 200 chữ) trình bày suy nghĩ của anh/chị: Từ góc nhìn của người trẻ, đề xuất các giải pháp để Việt Nam có những nhà phát minh công nghệ mang tầm vóc thế giới.",
    issue_statement: ISSUE_2026,
    solution_groups: [
      {
        id: "1",
        label: "Ý 1",
        items: [
          { id: "1.1", text: "(Nhập theo mục b. Yêu cầu cụ thể của Đáp án – ý 1.1)" },
          { id: "1.2", text: "(Nhập theo Đáp án – ý 1.2)" },
          { id: "1.3", text: "(Nhập theo Đáp án – ý 1.3)" },
        ],
      },
      {
        id: "2",
        label: "Ý 2",
        items: [
          { id: "2.1", text: "(Nhập theo Đáp án – ý 2.1)" },
          { id: "2.2", text: "(Nhập theo Đáp án – ý 2.2)" },
          { id: "2.3", text: "(Nhập theo Đáp án – ý 2.3)" },
        ],
      },
    ],
    grading_guide: "",
    rubric_version: rubric.version,
    confirmed: false,
    confirmed_by: null,
    confirmed_at: null,
    created_by: "gv-01",
    created_at: t,
  };
  await db().insert("prompts", prompt);
  return created;
}

export type { Round, Assignment, PeerReview, WriterResponse };
export { ApiError };
