import type { CriterionId } from "./rubric";

// Mã lỗi và tên ngắn lấy đúng từ "PHIẾU ĐÁNH GIÁ ĐỒNG ĐẲNG & CHẨN ĐOÁN LỖI".
// Giải thích, dấu hiệu, hướng khắc phục và ví dụ là nội dung bổ sung (chờ giáo viên duyệt).

export interface ErrorCode {
  code: string;
  criterionId: CriterionId;
  /** Tên ngắn in trên phiếu gốc. */
  shortName: string;
  name: string;
  explanation: string;
  signs: string[];
  fix: string;
  example: string;
}

export const ERROR_CODES: ErrorCode[] = [
  {
    code: "LĐ-SL",
    criterionId: "van_de",
    shortName: "Sai lệch",
    name: "Xác định sai lệch vấn đề nghị luận",
    explanation: "Đoạn văn bàn về một vấn đề khác, hoặc chỉ bàn một phần lệch khỏi yêu cầu của đề.",
    signs: [
      "Câu mở đoạn nêu vấn đề không trùng với từ khóa của đề.",
      "Đề yêu cầu đề xuất giải pháp nhưng bài chỉ bàn về vai trò, thực trạng hoặc nguyên nhân.",
      "Thay đổi đối tượng hoặc góc nhìn mà đề quy định.",
    ],
    fix: "Gạch chân từ khóa trong đề (đối tượng, góc nhìn, yêu cầu), viết lại câu mở đoạn nhắc đúng các từ khóa đó.",
    example:
      "Đề: “đề xuất giải pháp để Việt Nam có những nhà phát minh công nghệ…”. Bài viết: “Công nghệ có vai trò to lớn đối với đời sống…” rồi chỉ phân tích vai trò của công nghệ.",
  },
  {
    code: "LĐ-CC",
    criterionId: "van_de",
    shortName: "Chung chung",
    name: "Nêu vấn đề nghị luận chung chung",
    explanation: "Có chạm đến vấn đề nhưng diễn đạt mơ hồ, thiếu phạm vi, đối tượng hoặc góc nhìn cụ thể.",
    signs: [
      "Câu chủ đề có thể dùng cho nhiều đề khác nhau.",
      "Thiếu đối tượng (người trẻ, Việt Nam…) hoặc thiếu yêu cầu chính (giải pháp, ý kiến…).",
    ],
    fix: "Viết câu chủ đề trả lời đủ: Ai? Bàn về điều gì? Theo hướng nào (giải pháp/ý kiến)?",
    example: "“Công nghệ là vấn đề rất quan trọng trong cuộc sống ngày nay.”",
  },
  {
    code: "LL-S",
    criterionId: "giai_phap",
    shortName: "Sơ sài",
    name: "Giải pháp/ý kiến sơ sài",
    explanation: "Số ý chưa đủ theo yêu cầu, hoặc ý nêu ra quá ngắn, chưa làm rõ được nội dung.",
    signs: [
      "Chỉ có 1–2 giải pháp, mỗi giải pháp một vế câu.",
      "Thiếu hẳn một nhóm ý mà hướng dẫn chấm yêu cầu.",
    ],
    fix: "Đối chiếu nhóm ý của đề, bổ sung ý còn thiếu; mỗi giải pháp trả lời được “làm gì” và “làm như thế nào”.",
    example: "“Người trẻ cần học tập tốt và nhà nước cần quan tâm hơn.”",
  },
  {
    code: "LL-LK",
    criterionId: "giai_phap",
    shortName: "Liệt kê suông",
    name: "Liệt kê suông giải pháp",
    explanation: "Kể tên nhiều giải pháp thành chuỗi nhưng không giải thích vì sao, làm như thế nào.",
    signs: [
      "Một câu dài chứa nhiều giải pháp nối bằng dấu phẩy.",
      "Không có câu giải thích hay ví dụ đi kèm từng giải pháp.",
    ],
    fix: "Chọn các giải pháp quan trọng nhất; mỗi giải pháp thêm một câu giải thích cách làm hoặc tác dụng.",
    example: "“Cần đổi mới giáo dục, đầu tư nghiên cứu, khuyến khích sáng tạo, hợp tác quốc tế, thay đổi tư duy.”",
  },
  {
    code: "LL",
    criterionId: "lap_luan",
    shortName: "Lí lẽ yếu",
    name: "Lí lẽ yếu",
    explanation: "Lí lẽ cảm tính, khẳng định không có cơ sở, hoặc không đủ sức làm sáng tỏ luận điểm.",
    signs: [
      "Dùng nhiều khẳng định tuyệt đối (“ai cũng”, “chắc chắn”) mà không chứng minh.",
      "Lí lẽ lặp lại luận điểm thay vì giải thích.",
      "Có mâu thuẫn giữa các ý.",
    ],
    fix: "Với mỗi luận điểm, tự hỏi “Vì sao?” và viết câu trả lời dựa trên quan hệ nguyên nhân – kết quả.",
    example: "“Người trẻ chắc chắn sẽ thành công vì người trẻ rất giỏi.”",
  },
  {
    code: "BC",
    criterionId: "lap_luan",
    shortName: "Thiếu dẫn chứng",
    name: "Thiếu dẫn chứng",
    explanation: "Không có bằng chứng, hoặc bằng chứng mơ hồ, thiếu xác thực, không phù hợp luận điểm.",
    signs: [
      "Không có ví dụ về người, sự việc, số liệu cụ thể.",
      "Dẫn chứng chung chung (“nhiều người”, “có một bạn”).",
    ],
    fix: "Bổ sung ít nhất 01 bằng chứng tiêu biểu, xác thực, gắn trực tiếp với luận điểm.",
    example: "“Có rất nhiều nhà phát minh trẻ đã thành công.” (không nêu ai, thành công gì)",
  },
  {
    code: "PT",
    criterionId: "lap_luan",
    shortName: "Chưa phân tích",
    name: "Chưa phân tích dẫn chứng",
    explanation: "Có dẫn chứng nhưng chưa phân tích ý nghĩa của dẫn chứng đối với luận điểm.",
    signs: [
      "Dẫn chứng đứng cuối câu/đoạn, không có câu bình luận sau đó.",
      "Người đọc không thấy dẫn chứng chứng minh cho ý nào.",
    ],
    fix: "Sau dẫn chứng, viết 1–2 câu giải thích dẫn chứng cho thấy điều gì và liên hệ trở lại luận điểm.",
    example: "Bài nêu tên một nhà khoa học Việt Nam rồi chuyển ngay sang ý khác, không giải thích dẫn chứng đó chứng minh điều gì.",
  },
  {
    code: "LK",
    criterionId: "lap_luan",
    shortName: "Thiếu liên kết",
    name: "Thiếu liên kết lập luận",
    explanation: "Các câu, các ý rời rạc; mạch lập luận bị đứt, thiếu phương tiện liên kết.",
    signs: [
      "Chuyển ý đột ngột, không có từ nối (trước hết, bên cạnh đó, vì vậy…).",
      "Câu sau không tiếp nối nội dung câu trước.",
    ],
    fix: "Sắp xếp ý theo trình tự hợp lí và thêm từ ngữ chuyển ý giữa các ý.",
    example: "“Cần đầu tư cho nghiên cứu. Nhiều bạn trẻ thích chơi điện tử. Nhà nước có nhiều chính sách.”",
  },
  {
    code: "HT-XD",
    criterionId: "hinh_thuc",
    shortName: "Xuống dòng",
    name: "Xuống dòng sai hình thức đoạn văn",
    explanation: "Bài viết bị tách thành nhiều đoạn hoặc xuống dòng tùy tiện, không bảo đảm hình thức một đoạn văn.",
    signs: ["Có từ hai đoạn trở lên.", "Xuống dòng giữa câu hoặc sau mỗi ý."],
    fix: "Viết liền mạch thành một đoạn: lùi đầu dòng một lần, viết hoa chữ đầu, kết thúc bằng dấu chấm.",
    example: "Mỗi giải pháp được viết thành một dòng riêng như gạch đầu dòng.",
  },
  {
    code: "HT-DL",
    criterionId: "hinh_thuc",
    shortName: "Sai dung lượng",
    name: "Sai dung lượng",
    explanation: "Dung lượng nằm ngoài khoảng 200 ± 100 chữ (dưới 100 chữ hoặc trên 300 chữ).",
    signs: ["Bộ đếm chữ hiển thị dưới 100 hoặc trên 300 chữ."],
    fix: "Dưới 100 chữ: bổ sung lí lẽ/dẫn chứng. Trên 300 chữ: lược ý trùng lặp, câu rườm rà.",
    example: "Đoạn văn chỉ có 4 câu, khoảng 70 chữ.",
  },
  {
    code: "CT-NG",
    criterionId: "hinh_thuc",
    shortName: "Chính tả/Diễn đạt vụng",
    name: "Lỗi chính tả, ngữ pháp, diễn đạt vụng",
    explanation: "Sai chính tả, dùng từ chưa chính xác, câu sai ngữ pháp hoặc lủng củng, khó hiểu.",
    signs: [
      "Sai dấu thanh, sai phụ âm (s/x, ch/tr, l/n…).",
      "Câu thiếu chủ ngữ hoặc vị ngữ; câu quá dài, nhiều tầng ý.",
      "Lặp từ, dùng từ không đúng nghĩa.",
    ],
    fix: "Đọc lại từng câu; tách câu dài, bổ sung thành phần câu còn thiếu, sửa chính tả theo từ điển.",
    example: "“Với sự phát triễn của công nghệ đã giúp cho đất nước.” (sai chính tả, câu thiếu chủ ngữ)",
  },
];

export const ERROR_CODE_MAP: Record<string, ErrorCode> = Object.fromEntries(ERROR_CODES.map((e) => [e.code, e]));

export function codesForCriterion(criterionId: CriterionId): ErrorCode[] {
  return ERROR_CODES.filter((e) => e.criterionId === criterionId);
}

export function isValidCode(code: string, criterionId?: CriterionId): boolean {
  const e = ERROR_CODE_MAP[code];
  return !!e && (!criterionId || e.criterionId === criterionId);
}
