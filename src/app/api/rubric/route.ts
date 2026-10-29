import { z } from "zod";
import { body, route } from "@/lib/server/http";
import { confirmRubric, getRubricInfo } from "@/lib/server/services";

export const GET = route(() => getRubricInfo());

export const POST = route(
  async ({ user, req }) => {
    const { notes } = await body(req, z.object({ notes: z.string().max(3000) }));
    return confirmRubric(user, notes);
  },
  { role: "teacher" },
);
