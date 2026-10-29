import { body, route } from "@/lib/server/http";
import { PairingIn, setPairing } from "@/lib/server/services";

export const POST = route<{ id: string }>(async ({ req, params }) => setPairing(params.id, await body(req, PairingIn)), {
  role: "teacher",
});
