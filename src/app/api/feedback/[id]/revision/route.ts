import { after } from "next/server";
import { z } from "zod";
import { body, route } from "@/lib/server/http";
import { saveRevision, tryAutoGrade } from "@/lib/server/services";

export const maxDuration = 300;

export const PUT = route<{ id: string }>(async ({ user, req, params }) => {
  const { content, submit } = await body(req, z.object({ content: z.string().max(20000), submit: z.boolean() }));
  const version = await saveRevision(user, params.id, content, submit);
  if (submit) after(() => tryAutoGrade(version.id));
  return version;
});
