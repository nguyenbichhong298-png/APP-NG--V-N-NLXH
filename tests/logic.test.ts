import { describe, expect, it } from "vitest";
import { generatePairs, validateManualPairs } from "@/lib/pairing";
import { computeRoundStats, referenceFromCriteria } from "@/lib/stats";
import { countParagraphs, countWords, diffWords, quoteInText } from "@/lib/text";
import { normalizeCriteria } from "@/lib/scoring";
import { postProcess } from "@/lib/server/ai";
import type { Assignment, PeerReview, WriterResponse } from "@/lib/types";

describe("Văn bản", () => {
  it("đếm chữ tiếng Việt theo âm tiết", () => {
    expect(countWords("Người trẻ cần dám nghĩ, dám làm.")).toBe(7);
    expect(countWords("  ")).toBe(0);
    expect(countParagraphs("a\n\nb\nc")).toBe(3);
  });
  it("kiểm tra trích dẫn có trong bài", () => {
    const t = "Người trẻ cần “dám nghĩ” và dám làm.";
    expect(quoteInText('"dám nghĩ" và dám', t)).toBe(true);
    expect(quoteInText("không có câu này", t)).toBe(false);
  });
  it("so sánh theo từ", () => {
    const ops = diffWords("a b c", "a x c");
    expect(ops.filter((o) => o.type === "add").map((o) => o.text.trim())).toContain("x");
    expect(ops.filter((o) => o.type === "del").map((o) => o.text.trim())).toContain("b");
  });
});

describe("Ghép cặp", () => {
  const ids = ["a", "b", "c", "d", "e"];
  it("không ai tự đánh giá mình", () => {
    for (const mode of ["pairs", "rotation", "groups"] as const) {
      expect(generatePairs(ids, mode).every((p) => p.reviewerId !== p.writerId)).toBe(true);
    }
  });
  it("xoay vòng: mỗi bài có đúng một người đánh giá", () => {
    const p = generatePairs(ids, "rotation");
    expect(new Set(p.map((x) => x.writerId)).size).toBe(5);
    expect(new Set(p.map((x) => x.reviewerId)).size).toBe(5);
  });
  it("ghép đôi với số lẻ: mọi bài đều có người chấm", () => {
    const p = generatePairs(ids, "pairs");
    expect(new Set(p.map((x) => x.writerId))).toEqual(new Set(ids));
  });
  it("phân nhóm 3: mỗi bạn chấm 2 bài trong nhóm", () => {
    const p = generatePairs(["a", "b", "c", "d", "e", "f"], "groups", 3);
    expect(p).toHaveLength(12);
  });
  it("phân công thủ công phát hiện tự chấm và trùng", () => {
    expect(validateManualPairs([{ reviewerId: "a", writerId: "a", group: null }])).toBeTruthy();
    expect(
      validateManualPairs([
        { reviewerId: "a", writerId: "b", group: null },
        { reviewerId: "a", writerId: "b", group: null },
      ]),
    ).toBeTruthy();
  });
});

describe("Thống kê đợt", () => {
  const now = new Date().toISOString();
  const crit = (levels: [number, number, number, number], codes: string[][]) =>
    normalizeCriteria(
      (["van_de", "giai_phap", "lap_luan", "hinh_thuc"] as const).map((id, i) => ({
        criterion_id: id,
        level: levels[i] as 1 | 2 | 3 | 4,
        error_codes: codes[i] ?? [],
        evidence: "",
        explanation: "",
      })),
    );
  const a = (id: string): Assignment => ({ id, round_id: "r", writer_id: "w" + id, reviewer_id: "x" + id, group_label: null, essay_version_id: "v" + id, status: "submitted", created_at: now });
  const review = (id: string, criteria: ReturnType<typeof crit>): PeerReview => ({
    id: "pr" + id,
    assignment_id: id,
    essay_version_id: "v" + id,
    rubric_version: "x",
    criteria,
    total: null,
    primary_error_code: null,
    highlight: "",
    main_issue_evidence: "",
    main_issue_explanation: "",
    suggestion: "",
    feedback_check: null,
    status: "submitted",
    updated_at: now,
    submitted_at: now,
  });

  it("tính tỉ lệ hoàn thành, tần suất mã, độ chính xác và khắc phục", () => {
    const peer = crit([4, 3, 3, 4], [[], ["LL-S"], ["PT"], []]);
    const teacher = crit([4, 3, 3, 4], [[], ["LL-S"], ["BC"], []]);
    const revised = crit([4, 4, 4, 4], [[], [], ["BC"], []]);
    const responses: WriterResponse[] = [
      { id: "wr", assignment_id: "1", acceptance: "full", planned_actions: ["reasoning_evidence"], explanation: "", revised_version_id: "v1b", status: "submitted", updated_at: now },
    ];
    const s = computeRoundStats({
      assignments: [a("1"), a("2")],
      reviews: [review("1", peer)],
      responses,
      references: {
        v1: referenceFromCriteria("teacher", teacher),
        v1b: referenceFromCriteria("teacher", revised),
      },
      revisions: [{ originalVersionId: "v1", revisedVersionId: "v1b" }],
    });
    expect(s.completion.reviewRate).toBe(50);
    expect(s.codeFrequency.find((c) => c.code === "PT")?.peer).toBe(1);
    expect(s.detectedErrors).toEqual([{ code: "LL-S", count: 1 }]);
    expect(s.missedErrors).toEqual([{ code: "BC", count: 1 }]);
    expect(s.extraErrors).toEqual([{ code: "PT", count: 1 }]);
    expect(s.accuracy.perCriterion.every((p) => p.levelAgreement === 100)).toBe(true);
    expect(s.revision.fixRate).toBe(50);
    expect(s.revision.totalBefore).toBe(1.5);
    expect(s.revision.totalAfter).toBe(2);
  });
});

describe("Hậu xử lí kết quả AI", () => {
  const essay = "Người trẻ cần dám nghĩ lớn. Ví dụ như anh Trương Gia Bình đã sáng lập FPT.";
  it("tính lại điểm từ mức, lọc mã sai tiêu chí, đánh dấu trích dẫn không khớp", () => {
    const r = postProcess(
      {
        criteria: [
          { criterion_id: "van_de", level: 4, evidence: ["Người trẻ cần dám nghĩ lớn."], rationale: "" },
          { criterion_id: "giai_phap", level: 2, evidence: ["câu không có trong bài"], rationale: "" },
          { criterion_id: "lap_luan", level: 3, evidence: [], rationale: "" },
          { criterion_id: "hinh_thuc", level: 9, evidence: [], rationale: "" },
        ],
        strengths: [],
        weaknesses: [],
        errors: [
          { code: "PT", criterion_id: "lap_luan", quote: "đã sáng lập FPT", location: "câu 2", reason: "", fix: "" },
          { code: "PT", criterion_id: "van_de", quote: "x", location: "", reason: "", fix: "" },
          { code: "BC", criterion_id: "lap_luan", quote: "không khớp", location: "", reason: "", fix: "" },
        ],
        style_suggestions: [],
        reference_paragraph: "",
        practice_prompts: ["1", "2", "3", "4"],
      },
      essay,
    );
    expect(r.criteria.map((c) => c.score)).toEqual([0.25, 0.5, 0.25, 0]);
    expect(r.total).toBe(1);
    expect(r.criteria[1].evidence).toEqual([]);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0].quote_verified).toBe(true);
    expect(r.errors[1].quote_verified).toBe(false);
    expect(r.practice_prompts).toHaveLength(3);
  });
});
