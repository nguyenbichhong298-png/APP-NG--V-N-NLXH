import { body, route } from "@/lib/server/http";
import { confirmPrompt, PromptIn, updatePrompt } from "@/lib/server/services";

export const PUT = route<{ id: string }>(async ({ req, params }) => updatePrompt(params.id, await body(req, PromptIn)), {
  role: "teacher",
});

/** Giáo viên xác nhận yêu cầu nội dung và hướng dẫn chấm của đề. */
export const POST = route<{ id: string }>(async ({ user, params }) => confirmPrompt(user, params.id), { role: "teacher" });
