import { Resend } from "resend";

const FROM_EMAIL = "OptiRecipe <noreply@thekreatorhub.com>";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not configured, emails will be skipped");
    return null;
  }
  return new Resend(apiKey);
}

/**
 * Send OTP verification email for login
 */
export async function sendOTPEmail(to: string, otp: string): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.log(`[Email] Skipping OTP email to ${to} (no Resend key)`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${otp} — Votre code de connexion OptiRecipe`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:0 20px;">
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:40px 32px;backdrop-filter:blur(20px);">
      <div style="text-align:center;margin-bottom:32px;">
        <h1 style="color:#00D4FF;font-size:24px;font-weight:700;margin:0 0 8px;">OptiRecipe</h1>
        <p style="color:#9ca3af;font-size:14px;margin:0;">Votre code de connexion</p>
      </div>
      <div style="background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#ffffff;">${otp}</span>
      </div>
      <p style="color:#9ca3af;font-size:13px;text-align:center;line-height:1.5;margin:0;">
        Ce code expire dans 10 minutes.<br>
        Si vous n'avez pas demande ce code, ignorez cet email.
      </p>
    </div>
    <p style="text-align:center;color:#6b7280;font-size:11px;margin-top:24px;">
      OptiRecipe par OptiMenu &copy; ${new Date().getFullYear()}
    </p>
  </div>
</body>
</html>`,
  });

  if (error) {
    console.error("[Email] Failed to send OTP:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}

/**
 * Send extraction completion notification email
 */
export async function sendExtractionCompleteEmail(
  to: string,
  cookbookName: string,
  recipesExtracted: number,
  totalPages: number,
  appUrl: string
): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.log(`[Email] Skipping extraction email to ${to} (no Resend key)`);
    return;
  }

  const recipesLabel = recipesExtracted === 1 ? "recette extraite" : "recettes extraites";

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${recipesExtracted} ${recipesLabel} de "${cookbookName}"`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:0 20px;">
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:40px 32px;">
      <div style="text-align:center;margin-bottom:32px;">
        <h1 style="color:#00D4FF;font-size:24px;font-weight:700;margin:0 0 8px;">OptiRecipe</h1>
        <p style="color:#9ca3af;font-size:14px;margin:0;">Extraction terminee</p>
      </div>

      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <span style="font-size:48px;font-weight:700;color:#10B981;">${recipesExtracted}</span>
        <p style="color:#d1d5db;font-size:14px;margin:8px 0 0;">${recipesLabel}</p>
      </div>

      <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:16px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:4px 0;">Livre</td>
            <td style="color:#ffffff;font-size:13px;padding:4px 0;text-align:right;font-weight:500;">${cookbookName}</td>
          </tr>
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:4px 0;">Pages analysees</td>
            <td style="color:#ffffff;font-size:13px;padding:4px 0;text-align:right;font-weight:500;">${totalPages}</td>
          </tr>
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:4px 0;">Statut</td>
            <td style="color:#10B981;font-size:13px;padding:4px 0;text-align:right;font-weight:500;">Termine</td>
          </tr>
        </table>
      </div>

      <a href="${appUrl}/recipes?cookbookId=all&status=approved"
         style="display:block;text-align:center;background:linear-gradient(135deg,#00D4FF,#0066FF);color:#ffffff;font-weight:600;font-size:14px;padding:14px 24px;border-radius:10px;text-decoration:none;">
        Voir mes recettes
      </a>
    </div>
    <p style="text-align:center;color:#6b7280;font-size:11px;margin-top:24px;">
      OptiRecipe par OptiMenu &copy; ${new Date().getFullYear()}
    </p>
  </div>
</body>
</html>`,
  });

  if (error) {
    console.error("[Email] Failed to send extraction email:", error);
    // Don't throw - extraction emails are non-critical
  } else {
    console.log(`[Email] Extraction complete email sent to ${to}`);
  }
}
