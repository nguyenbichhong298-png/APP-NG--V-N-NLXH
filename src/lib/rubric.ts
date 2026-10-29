// Số hóa nguyên văn "RUBRIC CHẤM ĐIỂM PHẦN II. VIẾT – Câu 1 (2,0 điểm)",
// Kỳ thi tốt nghiệp THPT năm 2026, môn Ngữ văn (Bộ GD&ĐT).
// Mô tả mức và điểm số giữ nguyên tài liệu gốc. Các điểm tài liệu gốc chưa
// thống nhất được ghi ở `sourceNotes` (không làm thay đổi điểm), chờ giáo viên xác nhận.

export type CriterionId = "van_de" | "giai_phap" | "lap_luan" | "hinh_thuc";
export type Level = 1 | 2 | 3 | 4;

export const LEVELS: Level[] = [4, 3, 2, 1];

export const LEVEL_NAMES: Record<Level, string> = {
  4: "Tốt",
  3: "Khá",
  2: "Trung bình",
  1: "Cần cố gắng",
};

export interface RubricLevel {
  level: Level;
  /** Các dòng mô tả, giữ nguyên văn tài liệu gốc. */
  description: string[];
  score: number;
}

export interface RubricCriterion {
  id: CriterionId;
  order: number;
  /** Tên tiêu chí trên Phiếu đánh giá đồng đẳng. */
  name: string;
  /** Tên tiêu chí/thành phần trong Rubric gốc. */
  rubricName: string;
  /** Nhóm tiêu chí trong Rubric gốc. */
  rubricGroup: string;
  maxScore: number;
  levels: RubricLevel[];
  sourceNotes: string[];
}

export interface Rubric {
  version: string;
  title: string;
  source: string;
  totalMax: number;
  /** Khung tổng điểm theo mức, ghi ở hàng tiêu đề của Rubric gốc. */
  totalBands: { level: Level; min: number; max: number; label: string }[];
  criteria: RubricCriterion[];
}

/** Đặt vào mô tả tiêu chí 1; được thay bằng vấn đề nghị luận giáo viên đã xác nhận cho từng đề. */
export const ISSUE_PLACEHOLDER = "{{VAN_DE_NGHI_LUAN}}";

export const ISSUE_2026 =
  "Từ góc nhìn của người trẻ, đề xuất các giải pháp để Việt Nam có những nhà phát minh công nghệ mang tầm vóc thế giới.";

export const RUBRIC_2026: Rubric = {
  version: "TN2026-NLXH-v1",
  title: "Rubric chấm đoạn văn nghị luận xã hội 200 chữ",
  source:
    "Rubric chấm điểm phần II. Viết – Câu 1 (2,0 điểm), Đề thi chính thức Kỳ thi tốt nghiệp THPT năm 2026, môn Ngữ văn",
  totalMax: 2.0,
  totalBands: [
    { level: 4, min: 1.75, max: 2.0, label: "1,75 - 2,0 điểm" },
    { level: 3, min: 1.25, max: 1.5, label: "1,25 - 1,5 điểm" },
    { level: 2, min: 0.75, max: 1.0, label: "0,75 - 1,0 điểm" },
    { level: 1, min: 0.0, max: 0.5, label: "0,0 - 0,5 điểm" },
  ],
  criteria: [
    {
      id: "van_de",
      order: 1,
      name: "Xác định vấn đề nghị luận",
      rubricName: "Xác định đúng vấn đề nghị luận (0,25 điểm)",
      rubricGroup: "I. Nội dung kiến thức (1,25 điểm)",
      maxScore: 0.25,
      levels: [
        { level: 4, description: [`- Xác định đúng vấn đề nghị luận: ${ISSUE_PLACEHOLDER}`], score: 0.25 },
        { level: 3, description: [`- Xác định đúng vấn đề nghị luận: ${ISSUE_PLACEHOLDER}`], score: 0.25 },
        { level: 2, description: [`- Xác định đúng vấn đề nghị luận: ${ISSUE_PLACEHOLDER}`], score: 0.25 },
        { level: 1, description: ["- Không xác định được hoặc xác định sai vấn đề nghị luận."], score: 0.0 },
      ],
      sourceNotes: [
        "Trong Rubric gốc, Mức 4, Mức 3 và Mức 2 dùng chung một ô mô tả và cùng 0,25 điểm.",
        "Vấn đề nghị luận gắn với từng đề; giáo viên nhập và xác nhận cho mỗi đề mới.",
      ],
    },
    {
      id: "giai_phap",
      order: 2,
      name: "Nội dung giải pháp / ý kiến",
      rubricName: "Các giải pháp (1,0 điểm)",
      rubricGroup: "I. Nội dung kiến thức (1,25 điểm)",
      maxScore: 1.0,
      levels: [
        {
          level: 4,
          description: [
            "Nêu đủ 03 ý trong ý 1 (ý 1.1, 1.2, 1.3) và nêu được 01 ý trong ý 2 (ý 2.1, 2.2, 2.3) ở mục “b. Yêu cầu cụ thể” của Đáp án.",
          ],
          score: 1.0,
        },
        { level: 3, description: ["- Nêu được 02 ý trong ý 1 và nêu được 01 ý trong ý 2."], score: 0.75 },
        {
          level: 2,
          description: [
            "- Nêu được 01 ý trong ý 1 và nêu được 01 ý trong ý 2;",
            "hoặc nêu được 03 ý trong ý 1;",
            "hoặc nêu được 03 ý trong ý 2.",
          ],
          score: 0.5,
        },
        {
          level: 1,
          description: [
            "- Nêu được 01 ý trong ý 1 hoặc nêu được 01 ý trong ý 2;",
            "hoặc nêu được 02 ý trong ý 2.",
          ],
          score: 0.25,
        },
      ],
      sourceNotes: [
        "Các ý 1.1–1.3 và 2.1–2.3 lấy từ mục “b. Yêu cầu cụ thể” của Đáp án; với đề mới, giáo viên nhập và xác nhận nhóm ý.",
        "Rubric gốc chưa quy định một số trường hợp (ví dụ: 02 ý trong ý 1 nhưng không có ý nào trong ý 2; không nêu được giải pháp nào). Hệ thống không tự quy đổi — giáo viên quyết định.",
      ],
    },
    {
      id: "lap_luan",
      order: 3,
      name: "Kĩ năng lập luận & Bằng chứng",
      rubricName: "II. Kỹ năng phân tích và lập luận (0,5 điểm)",
      rubricGroup: "II. Kỹ năng phân tích và lập luận (0,5 điểm)",
      maxScore: 0.5,
      levels: [
        {
          level: 4,
          description: [
            "- Trình bày được quan điểm của bản thân.",
            "- Lựa chọn được thao tác nghị luận phù hợp.",
            "- Lập luận chặt chẽ, logic, có 01 bằng chứng thuyết phục.",
          ],
          score: 0.5,
        },
        { level: 3, description: ["- Đáp ứng được 01 trong 03 yêu cầu như mức 4."], score: 0.25 },
        { level: 2, description: ["- Không đáp ứng được yêu cầu nào như mức 4."], score: 0.0 },
        { level: 1, description: ["- Không đáp ứng được yêu cầu nào như mức 4."], score: 0.0 },
      ],
      sourceNotes: [
        "Rubric gốc chưa có mức cho trường hợp đáp ứng 02/03 yêu cầu. Đề xuất (chờ GV xác nhận): xếp Mức 3.",
        "Mức 2 và Mức 1 trong Rubric gốc có cùng mô tả và cùng 0,0 điểm.",
      ],
    },
    {
      id: "hinh_thuc",
      order: 4,
      name: "Hình thức & Diễn đạt",
      rubricName: "III. Hình thức và ngôn ngữ (0,25 điểm)",
      rubricGroup: "III. Hình thức và ngôn ngữ (0,25 điểm)",
      maxScore: 0.25,
      levels: [
        {
          level: 4,
          description: [
            "- Bảo đảm cách thức trình bày đoạn văn.",
            "- Hành văn trong sáng, giàu cảm xúc, đúng ngữ pháp tiếng Việt, không có lỗi chính tả.",
            "- Trình bày khoa học, rõ ràng, sạch đẹp.",
            "- Dung lượng: 200 ± 100 chữ.",
          ],
          score: 0.25,
        },
        {
          level: 3,
          description: [
            "- Thí sinh đáp ứng được đầy đủ 03 trong 04 yêu cầu như mức 4.",
            "- Thí sinh đáp ứng được 04 yêu cầu nhưng chưa đầy đủ như mức 4.",
          ],
          score: 0.25,
        },
        {
          level: 2,
          description: [
            "- Thí sinh đáp ứng được 02 trong 04 yêu cầu như mức 4.",
            "- Thí sinh đáp ứng được 03 yêu cầu nhưng chưa đầy đủ như mức 4.",
          ],
          score: 0.25,
        },
        {
          level: 1,
          description: [
            "- Thí sinh đáp ứng được 01 trong 04 yêu cầu như mức 4.",
            "- Thí sinh đáp ứng được 03 yêu cầu nhưng chưa đầy đủ như mức 4.",
          ],
          score: 0.0,
        },
      ],
      sourceNotes: [
        "Vế thứ hai của Mức 2 (0,25 điểm) và Mức 1 (0,0 điểm) trong Rubric gốc trùng nội dung. Đề xuất (chờ GV xác nhận): Mức 1 hiểu là “đáp ứng 01/04, hoặc 02 yêu cầu chưa đầy đủ”.",
      ],
    },
  ],
};

export function getCriterion(id: CriterionId, rubric: Rubric = RUBRIC_2026): RubricCriterion {
  const c = rubric.criteria.find((x) => x.id === id);
  if (!c) throw new Error(`Không có tiêu chí ${id}`);
  return c;
}

/** Thay chỗ trống vấn đề nghị luận trong mô tả bằng vấn đề của đề bài đang dùng. */
export function renderDescription(line: string, issue: string | null | undefined): string {
  return line.replace(ISSUE_PLACEHOLDER, issue?.trim() || "[vấn đề nghị luận của đề – giáo viên xác nhận]");
}

export function bandForTotal(total: number, rubric: Rubric = RUBRIC_2026) {
  // Khung điểm gốc có khoảng trống giữa các mức (ví dụ 1,5 → 1,75); lấy mức có min ≤ tổng.
  return [...rubric.totalBands].sort((a, b) => b.min - a.min).find((b) => total >= b.min - 1e-9) ?? null;
}
