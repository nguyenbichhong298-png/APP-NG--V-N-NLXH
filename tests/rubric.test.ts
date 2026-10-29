import { describe, expect, it } from "vitest";
import { ERROR_CODES, codesForCriterion } from "@/lib/error-codes";
import { bandForTotal, RUBRIC_2026 } from "@/lib/rubric";
import { emptyCriteria, normalizeCriteria, scoreForLevel, suggestSolutionLevel, sumScores, totalOf, validatePeerReview } from "@/lib/scoring";

describe("Rubric số hóa khớp tài liệu gốc", () => {
  it("bốn tiêu chí với điểm tối đa 0,25 / 1,0 / 0,5 / 0,25, tổng 2,0", () => {
    expect(RUBRIC_2026.criteria.map((c) => c.maxScore)).toEqual([0.25, 1.0, 0.5, 0.25]);
    expect(sumScores(RUBRIC_2026.criteria.map((c) => c.maxScore))).toBe(2);
  });

  it("điểm từng mức đúng bảng gốc", () => {
    const table = Object.fromEntries(RUBRIC_2026.criteria.map((c) => [c.id, c.levels.map((l) => [l.level, l.score])]));
    expect(table).toEqual({
      van_de: [[4, 0.25], [3, 0.25], [2, 0.25], [1, 0]],
      giai_phap: [[4, 1], [3, 0.75], [2, 0.5], [1, 0.25]],
      lap_luan: [[4, 0.5], [3, 0.25], [2, 0], [1, 0]],
      hinh_thuc: [[4, 0.25], [3, 0.25], [2, 0.25], [1, 0]],
    });
  });

  it("bảng mã lỗi đúng 11 mã theo phiếu, chia đúng nhóm tiêu chí", () => {
    expect(ERROR_CODES).toHaveLength(11);
    expect(codesForCriterion("van_de").map((e) => e.code)).toEqual(["LĐ-SL", "LĐ-CC"]);
    expect(codesForCriterion("giai_phap").map((e) => e.code)).toEqual(["LL-S", "LL-LK"]);
    expect(codesForCriterion("lap_luan").map((e) => e.code)).toEqual(["LL", "BC", "PT", "LK"]);
    expect(codesForCriterion("hinh_thuc").map((e) => e.code)).toEqual(["HT-XD", "HT-DL", "CT-NG"]);
  });

  it("khung tổng điểm", () => {
    expect(bandForTotal(2)?.level).toBe(4);
    expect(bandForTotal(1.75)?.level).toBe(4);
    expect(bandForTotal(1.5)?.level).toBe(3);
    expect(bandForTotal(1.0)?.level).toBe(2);
    expect(bandForTotal(0.5)?.level).toBe(1);
    expect(bandForTotal(0)?.level).toBe(1);
  });
});

describe("Tính điểm", () => {
  it("cộng điểm theo mức, không sai số dấu phẩy động", () => {
    const c = normalizeCriteria([
      { criterion_id: "van_de", level: 4, error_codes: [], evidence: "", explanation: "" },
      { criterion_id: "giai_phap", level: 3, error_codes: ["LL-S"], evidence: "", explanation: "" },
      { criterion_id: "lap_luan", level: 3, error_codes: ["PT"], evidence: "", explanation: "" },
      { criterion_id: "hinh_thuc", level: 2, error_codes: [], evidence: "", explanation: "" },
    ]);
    expect(totalOf(c)).toBe(1.5);
  });

  it("bỏ qua điểm do client gửi, lấy theo mức", () => {
    const c = normalizeCriteria([{ criterion_id: "giai_phap", level: 2, score: 1, error_codes: [], evidence: "", explanation: "" }]);
    expect(c.find((x) => x.criterion_id === "giai_phap")?.score).toBe(0.5);
  });

  it("lọc mã lỗi không thuộc tiêu chí", () => {
    const c = normalizeCriteria([{ criterion_id: "van_de", level: 1, error_codes: ["PT", "LĐ-SL", "XYZ"], evidence: "", explanation: "" }]);
    expect(c[0].error_codes).toEqual(["LĐ-SL"]);
  });

  it("số lượng mã lỗi không làm trừ thêm điểm", () => {
    const one = normalizeCriteria([{ criterion_id: "lap_luan", level: 3, error_codes: ["PT"], evidence: "", explanation: "" }]);
    const many = normalizeCriteria([{ criterion_id: "lap_luan", level: 3, error_codes: ["PT", "BC", "LL", "LK"], evidence: "", explanation: "" }]);
    expect(one[2].score).toBe(many[2].score);
  });

  it("tổng là null khi còn tiêu chí chưa chọn mức", () => {
    expect(totalOf(normalizeCriteria(emptyCriteria()))).toBeNull();
    expect(scoreForLevel("lap_luan", 4)).toBe(0.5);
  });
});

describe("Kiểm tra phiếu", () => {
  const fb = {
    highlight: "Bạn xác định đúng vấn đề nghị luận và có quan điểm rõ ràng.",
    primary_error_code: "PT",
    main_issue_evidence: "ví dụ trong bài",
    main_issue_explanation: "Bạn đưa dẫn chứng nhưng chưa phân tích ý nghĩa của dẫn chứng.",
    suggestion: "Sau dẫn chứng, bổ sung một câu giải thích tác động của sự việc.",
  };
  const full = (codes: Record<string, string[]>) =>
    normalizeCriteria([
      { criterion_id: "van_de", level: 4, error_codes: codes.van_de ?? [], evidence: "", explanation: "" },
      { criterion_id: "giai_phap", level: 4, error_codes: codes.giai_phap ?? [], evidence: "", explanation: "" },
      { criterion_id: "lap_luan", level: 3, error_codes: codes.lap_luan ?? [], evidence: "", explanation: "" },
      { criterion_id: "hinh_thuc", level: 4, error_codes: [], evidence: "", explanation: "" },
    ]);

  it("tiêu chí chưa đạt tối đa bắt buộc chọn mã lỗi hoặc giải thích", () => {
    const errs = validatePeerReview(full({}), { ...fb, primary_error_code: null });
    expect(errs["criteria.lap_luan.codes"]).toBeDefined();
  });

  it("lỗi chính phải nằm trong các mã đã chọn", () => {
    expect(validatePeerReview(full({ lap_luan: ["BC"] }), fb).primary_error_code).toBeDefined();
    expect(validatePeerReview(full({ lap_luan: ["PT"] }), fb)).toEqual({});
  });

  it("thiếu mức đánh giá bị báo lỗi", () => {
    const errs = validatePeerReview(normalizeCriteria(emptyCriteria()), fb);
    expect(Object.keys(errs).filter((k) => k.endsWith(".level"))).toHaveLength(4);
  });

  it("ba ô phản hồi bắt buộc", () => {
    const errs = validatePeerReview(full({ lap_luan: ["PT"] }), { ...fb, highlight: "", suggestion: "" });
    expect(errs.highlight).toBeDefined();
    expect(errs.suggestion).toBeDefined();
  });
});

describe("Gợi ý mức tiêu chí 2 theo bảng gốc", () => {
  it.each([
    [3, 1, 4],
    [3, 2, 4],
    [2, 1, 3],
    [1, 1, 2],
    [3, 0, 2],
    [0, 3, 2],
    [1, 0, 1],
    [0, 1, 1],
    [0, 2, 1],
  ])("ý1=%i, ý2=%i → Mức %i", (n1, n2, level) => {
    expect(suggestSolutionLevel(n1, n2)).toBe(level);
  });

  it("trường hợp rubric gốc không quy định trả về null", () => {
    expect(suggestSolutionLevel(2, 0)).toBeNull();
    expect(suggestSolutionLevel(0, 0)).toBeNull();
  });
});
