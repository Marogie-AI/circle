import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { emailEnabled, sendVerificationEmail } from "@/lib/email";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: emailEnabled,
    minPasswordLength: 8,
  },
  emailVerification: {
    sendOnSignUp: emailEnabled,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, url });
    },
  },
  rateLimit: {
    enabled: true,
    window: 10,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 3 },
      "/sign-up/email": { window: 60, max: 3 },
    },
  },
  plugins: [nextCookies()],
});
