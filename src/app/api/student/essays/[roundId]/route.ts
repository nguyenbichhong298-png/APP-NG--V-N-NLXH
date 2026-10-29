import { after } from "next/server";
import { z } from "zod";
import { body, route } from "@/lib/server/http";
import { getMyEssay, saveOriginalEssay, tryAutoGrade } from "@/lib/server/services";

export const maxDuration = 300;

export const GET = route<{ roundId: string }>(({ user, params }) => getMyEssay(user, params.roundId));

export const PUT = route<{ roundId: string }>(async ({ user, req, params }) => {
  const { content, submit } = await body(req, z.object({ content: z.string().max(20000), submit: z.boolean() }));
  const version = await saveOriginalEssay(user, params.roundId, content, submit);
  // Sau khi nộp, AI chấm độc lập ở chế độ nền.
  if (submit) after(() => tryAutoGrade(version.id));
  return version;
});
