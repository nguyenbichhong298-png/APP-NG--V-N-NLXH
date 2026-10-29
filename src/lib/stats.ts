import { ERROR_CODES } from "./error-codes";
import { RUBRIC_2026, type CriterionId, type Rubric } from "./rubric";
import { sumScores } from "./scoring";
import type { Assignment, CriterionScore, PeerReview, WriterResponse } from "./types";

/** Một bản chấm tham chiếu (giáo viên, hoặc AI khi giáo viên chưa chấm). */
export interface ReferenceGrading {
  source: "teacher" | "ai";
  criteria: { criterion_id: CriterionId; level: number | null; score: number | null }[];
  codes: string[];
}

export interface StatsInput {
  assignments: Assignment[];
  reviews: PeerReview[];
  responses: WriterResponse[];
  /** Bản chấm tham chiếu theo id phiên bản bài viết. */
  references: Record<string, ReferenceGrading>;
  /** Cặp phiên bản gốc → bản sửa cuối cùng. */
  revisions: { originalVersionId: string; revisedVersionId: string }[];
}

export function referenceFromCriteria(source: "teacher" | "ai", criteria: CriterionScore[]): ReferenceGrading {
  return {
    source,
    criteria: criteria.map((c) => ({ criterion_id: c.criterion_id, level: c.level, score: c.score })),
    codes: [...new Set(criteria.flatMap((c) => c.error_codes))],
  };
}

const pct = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 1000) / 10);

export function computeRoundStats(input: StatsInput, rubric: Rubric = RUBRIC_2026) {
  const submitted = input.reviews.filter((r) => r.status === "submitted");
  const responded = input.responses.filter((r) => r.status === "submitted");

  // 1. Tỉ lệ hoàn thành phiếu
  const completion = {
    assignments: input.assignments.length,
    reviewsSubmitted: submitted.length,
    reviewRate: pct(submitted.length, input.assignments.length),
    responsesSubmitted: responded.length,
    responseRate: pct(responded.length, submitted.length),
  };

  // 2. Tần suất từng mã lỗi trong phiếu đồng đẳng
  const codeFrequency = ERROR_CODES.map((e) => ({
    code: e.code,
    name: e.shortName,
    criterionId: e.criterionId,
    peer: submitted.filter((r) => r.criteria.some((c) => c.error_codes.includes(e.code))).length,
    primary: submitted.filter((r) => r.primary_error_code === e.code).length,
  }));

  // 3–5. Độ chính xác so với bản chấm tham chiếu; lỗi nhận diện đúng / chưa nhận diện
  const perCriterion = rubric.criteria.map((c) => ({
    criterionId: c.id,
    name: c.name,
    compared: 0,
    sameLevel: 0,
    sameScore: 0,
    absDiffSum: 0,
  }));
  const detected: Record<string, number> = {};
  const missed: Record<string, number> = {};
  const extra: Record<string, number> = {};
  let compared = 0;
  let referenceSource: "teacher" | "ai" | "mixed" | null = null;
  for (const r of submitted) {
    const ref = input.references[r.essay_version_id];
    if (!ref) continue;
    compared++;
    referenceSource = referenceSource === null || referenceSource === ref.source ? ref.source : "mixed";
    for (const pc of perCriterion) {
      const peer = r.criteria.find((c) => c.criterion_id === pc.criterionId);
      const gold = ref.criteria.find((c) => c.criterion_id === pc.criterionId);
      if (!peer || !gold || peer.score === null || gold.score === null) continue;
      pc.compared++;
      if (peer.level === gold.level) pc.sameLevel++;
      if (peer.score === gold.score) pc.sameScore++;
      pc.absDiffSum += Math.abs(peer.score - gold.score);
    }
    const peerCodes = new Set(r.criteria.flatMap((c) => c.error_codes));
    for (const code of ref.codes) {
      if (peerCodes.has(code)) detected[code] = (detected[code] ?? 0) + 1;
      else missed[code] = (missed[code] ?? 0) + 1;
    }
    for (const code of peerCodes) if (!ref.codes.includes(code)) extra[code] = (extra[code] ?? 0) + 1;
  }
  const totalDetected = Object.values(detected).reduce((a, b) => a + b, 0);
  const totalMissed = Object.values(missed).reduce((a, b) => a + b, 0);
  const totalExtra = Object.values(extra).reduce((a, b) => a + b, 0);
  const accuracy = {
    compared,
    referenceSource,
    perCriterion: perCriterion.map((p) => ({
      criterionId: p.criterionId,
      name: p.name,
      compared: p.compared,
      levelAgreement: pct(p.sameLevel, p.compared),
      scoreAgreement: pct(p.sameScore, p.compared),
      meanAbsDiff: p.compared ? Math.round((p.absDiffSum / p.compared) * 100) / 100 : null,
    })),
    recall: pct(totalDetected, totalDetected + totalMissed),
    precision: pct(totalDetected, totalDetected + totalExtra),
  };
  const toList = (m: Record<string, number>) =>
    Object.entries(m)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);

  // 6–7. Tỉ lệ lỗi được khắc phục và thay đổi điểm theo tiêu chí sau khi viết lại
  let errorsBefore = 0;
  let errorsFixed = 0;
  const fixedByCode: Record<string, { before: number; fixed: number }> = {};
  const change = rubric.criteria.map((c) => ({ criterionId: c.id, name: c.name, n: 0, before: 0, after: 0 }));
  const totalChange = { n: 0, before: 0, after: 0 };
  for (const pair of input.revisions) {
    const a = input.references[pair.originalVersionId];
    const b = input.references[pair.revisedVersionId];
    if (!a || !b) continue;
    for (const code of a.codes) {
      errorsBefore++;
      fixedByCode[code] ??= { before: 0, fixed: 0 };
      fixedByCode[code].before++;
      if (!b.codes.includes(code)) {
        errorsFixed++;
        fixedByCode[code].fixed++;
      }
    }
    for (const ch of change) {
      const x = a.criteria.find((c) => c.criterion_id === ch.criterionId)?.score;
      const y = b.criteria.find((c) => c.criterion_id === ch.criterionId)?.score;
      if (x == null || y == null) continue;
      ch.n++;
      ch.before = sumScores([ch.before, x]);
      ch.after = sumScores([ch.after, y]);
    }
    totalChange.n++;
    totalChange.before = sumScores([totalChange.before, sumScores(a.criteria.map((c) => c.score))]);
    totalChange.after = sumScores([totalChange.after, sumScores(b.criteria.map((c) => c.score))]);
  }
  const avg = (s: number, n: number) => (n ? Math.round((s / n) * 100) / 100 : null);

  return {
    completion,
    codeFrequency,
    accuracy,
    detectedErrors: toList(detected),
    missedErrors: toList(missed),
    extraErrors: toList(extra),
    revision: {
      pairs: totalChange.n,
      errorsBefore,
      errorsFixed,
      fixRate: pct(errorsFixed, errorsBefore),
      byCode: Object.entries(fixedByCode).map(([code, v]) => ({ code, ...v, rate: pct(v.fixed, v.before) })),
      scoreChange: change.map((c) => ({
        criterionId: c.criterionId,
        name: c.name,
        n: c.n,
        before: avg(c.before, c.n),
        after: avg(c.after, c.n),
      })),
      totalBefore: avg(totalChange.before, totalChange.n),
      totalAfter: avg(totalChange.after, totalChange.n),
    },
  };
}

export type RoundStats = ReturnType<typeof computeRoundStats>;
