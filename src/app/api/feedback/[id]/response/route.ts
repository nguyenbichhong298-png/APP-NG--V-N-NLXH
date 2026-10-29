import { body, route } from "@/lib/server/http";
import { saveWriterResponse, WriterResponseIn } from "@/lib/server/services";

export const PUT = route<{ id: string }>(async ({ user, req, params }) =>
  saveWriterResponse(user, params.id, await body(req, WriterResponseIn)),
);
