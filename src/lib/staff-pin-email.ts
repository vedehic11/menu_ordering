export async function sendStaffPinSetupEmail({
  email,
  name,
  setupUrl,
}: {
  email: string;
  name: string;
  setupUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("PIN email is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Set up your My, Oh My staff PIN",
      text: [
        `Hello ${name},`,
        "",
        "An administrator has invited you to set up or reset your staff PIN.",
        `Open this one-time link within 30 minutes: ${setupUrl}`,
        "",
        "If you did not expect this email, contact the restaurant administrator.",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    console.error("Staff PIN email provider returned an error:", response.status);
    throw new Error("Could not send the PIN setup email. Check the email provider configuration.");
  }
}
