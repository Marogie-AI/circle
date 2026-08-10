import { apiUser } from "@/lib/api-auth";
import { listGroupsForUser } from "@/lib/queries/groups";

/** Groups the signed-in user belongs to. Already capped at SIDEBAR_GROUP_LIMIT. */
export async function GET(request: Request) {
  const authenticated = await apiUser(request);
  if ("error" in authenticated) return authenticated.error;

  return Response.json({
    groups: await listGroupsForUser(authenticated.session.user.id),
  });
}
