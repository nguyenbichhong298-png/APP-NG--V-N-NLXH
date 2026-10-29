import type { PairingMode } from "./types";

export interface Pair {
  writerId: string;
  reviewerId: string;
  group: string | null;
}

/**
 * Tạo phân công đánh giá từ danh sách học sinh.
 * - pairs: ghép đôi A↔B (đánh giá chéo); lẻ một bạn thì nhóm cuối có 3 bạn xoay vòng.
 * - rotation: xoay vòng A→B→C→…→A (mỗi bạn đánh giá đúng một bài, mỗi bài có đúng một người đánh giá).
 * - groups: chia nhóm `groupSize` bạn, mỗi bạn đánh giá mọi bài khác trong nhóm.
 * Không ai tự đánh giá bài của mình.
 */
export function generatePairs(studentIds: string[], mode: Exclude<PairingMode, "manual">, groupSize = 3): Pair[] {
  const ids = [...new Set(studentIds)];
  if (ids.length < 2) return [];
  if (mode === "rotation") {
    return ids.map((reviewerId, i) => ({ reviewerId, writerId: ids[(i + 1) % ids.length], group: null }));
  }
  if (mode === "pairs") {
    const out: Pair[] = [];
    const evenEnd = ids.length % 2 === 0 ? ids.length : ids.length - 3;
    let g = 1;
    for (let i = 0; i < evenEnd; i += 2, g++) {
      const [a, b] = [ids[i], ids[i + 1]];
      out.push({ reviewerId: a, writerId: b, group: `Cặp ${g}` }, { reviewerId: b, writerId: a, group: `Cặp ${g}` });
    }
    if (evenEnd < ids.length) {
      const trio = ids.slice(evenEnd);
      trio.forEach((r, i) => out.push({ reviewerId: r, writerId: trio[(i + 1) % 3], group: `Cặp ${g}` }));
    }
    return out;
  }
  const size = Math.max(2, groupSize);
  const groups: string[][] = [];
  for (let i = 0; i < ids.length; i += size) groups.push(ids.slice(i, i + size));
  // Nhóm cuối chỉ một bạn thì nhập vào nhóm trước.
  if (groups.length > 1 && groups[groups.length - 1].length === 1) groups[groups.length - 2].push(...groups.pop()!);
  return groups.flatMap((members, gi) =>
    members.flatMap((r) =>
      members.filter((w) => w !== r).map((w) => ({ reviewerId: r, writerId: w, group: `Nhóm ${gi + 1}` })),
    ),
  );
}

export function validateManualPairs(pairs: Pair[]): string | null {
  const seen = new Set<string>();
  for (const p of pairs) {
    if (p.writerId === p.reviewerId) return "Học sinh không thể tự đánh giá bài của mình.";
    const k = `${p.reviewerId}>${p.writerId}`;
    if (seen.has(k)) return "Có phân công bị trùng lặp.";
    seen.add(k);
  }
  return null;
}
