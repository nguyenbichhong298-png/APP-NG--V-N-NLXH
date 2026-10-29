/** Đếm "chữ" theo cách tính tiếng Việt: mỗi âm tiết cách nhau bởi khoảng trắng. */
export function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

/** Số đoạn văn (khối văn bản cách nhau bởi xuống dòng). */
export function countParagraphs(text: string): number {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

export const WORD_RANGE = { min: 100, max: 300, target: 200 };

/** Dấu hiệu tự động cho tiêu chí hình thức — chỉ gợi ý, không tự trừ điểm. */
export function formSignals(text: string) {
  const words = countWords(text);
  const paragraphs = countParagraphs(text);
  return {
    words,
    paragraphs,
    lengthOk: words >= WORD_RANGE.min && words <= WORD_RANGE.max,
    singleParagraph: paragraphs <= 1,
  };
}

function normalize(s: string): string {
  return s.normalize("NFC").replace(/[“”"«»]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Kiểm tra một trích dẫn có thực sự xuất hiện trong bài gốc. */
export function quoteInText(quote: string, text: string): boolean {
  const q = normalize(quote).replace(/^"|"$/g, "").replace(/\.\.\.|…/g, "").trim();
  if (q.length < 2) return false;
  return normalize(text).includes(q);
}

export type DiffOp = { type: "same" | "add" | "del"; text: string };

/** So sánh hai phiên bản theo từ (LCS). */
export function diffWords(a: string, b: string): DiffOp[] {
  const x = a.split(/(\s+)/).filter((t) => t !== "");
  const y = b.split(/(\s+)/).filter((t) => t !== "");
  const n = x.length;
  const m = y.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  const push = (type: DiffOp["type"], text: string) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.text += text;
    else ops.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      push("same", x[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("del", x[i++]);
    } else {
      push("add", y[j++]);
    }
  }
  while (i < n) push("del", x[i++]);
  while (j < m) push("add", y[j++]);
  return ops;
}
