import { route } from "@/lib/server/http";
import { getAIGrading, requestAIGrading } from "@/lib/server/services";

export const maxDuration = 300;

export const GET = route<{ versionId: string }>(({ user, params }) => getAIGrading(user, params.versionId));

/** Giáo viên yêu cầu AI chấm (hoặc chấm lại) một phiên bản bài viết. */
export const POST = route<{ versionId: string }>(({ user, params }) => requestAIGrading(user, params.versionId), {
  role: "teacher",
});
