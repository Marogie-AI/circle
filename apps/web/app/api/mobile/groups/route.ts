import { apiSession, jsonError } from "@/lib/api-auth";
import { listGroupsForUser } from "@/lib/queries/groups";

/** Groups the signed-in user belongs to. Already capped at SIDEBAR_GROUP_LIMIT. */
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) return jsonError(401, "unauthorized");

  return Response.json({ groups: await listGroupsForUser(session.user.id) });
}
