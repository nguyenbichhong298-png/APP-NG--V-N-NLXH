import { body, route } from "@/lib/server/http";
import { createPrompt, listPrompts, PromptIn } from "@/lib/server/services";

export const GET = route(() => listPrompts(), { role: "teacher" });

export const POST = route(async ({ user, req }) => createPrompt(user, await body(req, PromptIn)), { role: "teacher" });
