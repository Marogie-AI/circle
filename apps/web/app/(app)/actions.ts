"use server";

import { randomUUID } from "node:crypto";
import { groups, memberships } from "@/db/schema";
import { db } from "@/db";
import { requireSession } from "@/lib/guard";
import { redirect } from "next/navigation";

const MAX_CREATE_ATTEMPTS = 4;

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

  const baseSlug = makeSlug(name);
  let createdSlug: string | undefined;

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const slug =
      attempt === 0
        ? baseSlug
        : `${baseSlug}-${randomUUID().replace(/-/g, "").slice(0, 6)}`;

    try {
      await db.transaction(async (tx) => {
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

  redirect(`/groups/${createdSlug}`);
}
