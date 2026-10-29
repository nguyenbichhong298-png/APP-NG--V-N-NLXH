import { body, route } from "@/lib/server/http";
import { ReviewIn, runFeedbackCheck } from "@/lib/server/services";

export const maxDuration = 60;

/** AI kiểm tra tính đầy đủ, lịch sự, cụ thể của phản hồi; không viết thay. */
export const POST = route<{ id: string }>(async ({ user, req, params }) =>
  runFeedbackCheck(user, params.id, await body(req, ReviewIn)),
);
