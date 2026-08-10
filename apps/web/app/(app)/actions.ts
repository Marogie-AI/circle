"use server";

import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { groups, memberships, user } from "@/db/schema";
import { db } from "@/db";
import { requireSession } from "@/lib/guard";
import { allow } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const MAX_CREATE_ATTEMPTS = 4;
const MAX_OWNED_GROUPS = 50;
const GROUP_CREATE_LIMIT = { max: 5, windowSeconds: 60 * 60 };

function makeSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "group"
  );
}

function isUniqueViolation(error: unknown) {
  let current = error;

  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return false;
    }

    if ("code" in current && current.code === "23505") {
      return true;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

export async function createGroup(formData: FormData) {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 1 || name.length > 60) {
    throw new Error("Group name must be between 1 and 60 characters.");
  }
  if (
    !(await allow(
      `group-create:${session.user.id}`,
      GROUP_CREATE_LIMIT.max,
      GROUP_CREATE_LIMIT.windowSeconds,
    ))
  ) {
    throw new Error("You have created several groups recently. Try again later.");
  }

  const baseSlug = makeSlug(name);
  let createdSlug: string | undefined;

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const slug =
      attempt === 0
        ? baseSlug
        : `${baseSlug}-${randomUUID().replace(/-/g, "").slice(0, 6)}`;

    try {
      await db.transaction(async (tx) => {
        // Serialize the quota check for this owner. Without the row lock, concurrent
        // requests could all observe 49 groups and each insert a 50th.
        await tx
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, session.user.id))
          .for("update");

        const [{ total }] = await tx
          .select({ total: count() })
          .from(groups)
          .where(eq(groups.createdBy, session.user.id));
        if (total >= MAX_OWNED_GROUPS) {
          throw new Error(`Each account can own at most ${MAX_OWNED_GROUPS} groups.`);
        }

        const [group] = await tx
          .insert(groups)
          .values({ name, slug, createdBy: session.user.id })
          .returning({ id: groups.id });

        await tx.insert(memberships).values({
          groupId: group.id,
          userId: session.user.id,
          role: "owner",
        });
      });

      createdSlug = slug;
      break;
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === MAX_CREATE_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  if (!createdSlug) {
    throw new Error("Unable to create a unique group slug.");
  }

  revalidatePath("/groups");
  revalidatePath("/", "layout");
  redirect(`/groups/${createdSlug}`);
}
