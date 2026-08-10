import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
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
    // Vercel instances do not share memory and cold starts erase it. The database
    // backend makes the login/signup limits durable and atomic across instances.
    storage: "database",
    window: 10,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 3 },
      "/sign-up/email": { window: 60, max: 3 },
    },
  },
  // bearer lets the mobile client authenticate with the token returned in the sign-in
  // response body: the session cookie value is HMAC-signed, so that raw token cannot be
  // replayed as a cookie — bearer is what re-signs it. nextCookies stays last; it has to
  // see the final response to write Set-Cookie for the web app.
  plugins: [bearer(), nextCookies()],
});
