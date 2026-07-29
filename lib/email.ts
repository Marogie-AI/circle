import { Resend } from "resend";

export const emailEnabled = Boolean(process.env.RESEND_API_KEY);

let resend: Resend | undefined;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  resend ??= new Resend(apiKey);
  return resend;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function sendVerificationEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  if (!emailEnabled) {
    console.info("[dev] verification link for %s: %s", to, url);
    return;
  }

  try {
    const client = getResendClient();
    if (!client) {
      console.error("Failed to send verification email: RESEND_API_KEY is missing.");
      return;
    }

    const safeUrl = escapeHtml(url);
    const result = await client.emails.send({
      from: process.env.EMAIL_FROM ?? "Circle <onboarding@resend.dev>",
      to,
      subject: "Verify your email for Circle",
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #171717; max-width: 560px; margin: 0 auto;">
          <h1 style="font-size: 24px;">Verify your email</h1>
          <p>Confirm your email address to finish setting up your Circle account.</p>
          <p style="margin: 28px 0;">
            <a href="${safeUrl}" style="background: #171717; border-radius: 8px; color: #ffffff; display: inline-block; padding: 12px 18px; text-decoration: none;">Verify email</a>
          </p>
          <p style="font-size: 14px; color: #525252;">If the button does not work, copy and paste this URL into your browser:</p>
          <p style="font-size: 14px; overflow-wrap: anywhere;"><a href="${safeUrl}">${safeUrl}</a></p>
        </div>
      `,
      text: `Verify your email for Circle\n\nConfirm your email address by opening this link:\n${url}`,
    });

    if (result.error) {
      console.error("Failed to send verification email:", result.error);
    }
  } catch (error: unknown) {
    console.error("Failed to send verification email:", error);
  }
}
