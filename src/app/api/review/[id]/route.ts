import { body, route } from "@/lib/server/http";
import { reviewerView, ReviewIn, saveReview } from "@/lib/server/services";

export const GET = route<{ id: string }>(({ user, params }) => reviewerView(user, params.id));

/** Lưu nháp (submit=false) hoặc nộp phiếu (submit=true). */
export const PUT = route<{ id: string }>(async ({ user, req, params }) => saveReview(user, params.id, await body(req, ReviewIn)));
