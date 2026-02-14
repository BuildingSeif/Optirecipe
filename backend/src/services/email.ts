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

// Get the frontend URL for logo and links
function getAppUrl(): string {
  return process.env.BASE_URL || process.env.VITE_BASE_URL || "https://optirecipe.com";
}

/**
 * Shared email layout — brand header with logo + footer
 * Matches the app's dark theme, ct-card style, and gradient accents
 */
function emailLayout(content: string): string {
  const appUrl = getAppUrl();
  const logoUrl = `${appUrl}/logo.png`;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OptiRecipe</title>
</head>
<body style="margin:0;padding:0;background-color:#050507;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#050507;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <!-- Main container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${logoUrl}" alt="OptiRecipe" width="40" height="40" style="display:block;border-radius:10px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                      <span style="color:#ffffff;">Opti</span><span style="color:#00B4E6;">Recipe</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d0d12;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
                <!-- Top glow bar (matches ct-light-bar) -->
                <tr>
                  <td style="height:2px;background:linear-gradient(90deg,transparent 0%,#00B4E6 30%,#0066FF 70%,transparent 100%);"></td>
                </tr>
                <!-- Card content -->
                <tr>
                  <td style="padding:44px 40px 48px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:32px;">
              <p style="color:#4b5563;font-size:12px;line-height:1.6;margin:0;">
                OptiRecipe par OptiMenu &copy; ${year}
              </p>
              <p style="color:#374151;font-size:11px;margin:8px 0 0;">
                Cet email a ete envoye automatiquement. Merci de ne pas y repondre.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

  // Build individual digit cells for the OTP display
  const digits = otp.split("");
  const digitCells = digits
    .map(
      (d) =>
        `<td style="width:48px;height:56px;text-align:center;vertical-align:middle;background-color:#111118;border:1px solid rgba(255,255,255,0.08);border-radius:12px;font-size:28px;font-weight:700;color:#ffffff;">${d}</td>`
    )
    .join('<td style="width:8px;"></td>');

  const content = `
    <!-- Greeting -->
    <p style="color:#ffffff;font-size:18px;font-weight:600;margin:0 0 8px;letter-spacing:-0.2px;">
      Bonjour,
    </p>
    <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 36px;">
      Voici votre code de connexion OptiRecipe. Saisissez-le dans l'application pour acceder a votre espace.
    </p>

    <!-- OTP Code display -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 36px;">
      <tr>
        ${digitCells}
      </tr>
    </table>

    <!-- Expiry notice -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(0,180,230,0.06);border:1px solid rgba(0,180,230,0.12);border-radius:12px;margin-bottom:36px;">
      <tr>
        <td style="padding:18px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;padding-right:14px;">
                <div style="width:8px;height:8px;background:#00B4E6;border-radius:50%;margin-top:5px;"></div>
              </td>
              <td>
                <p style="color:#d1d5db;font-size:14px;line-height:1.6;margin:0;">
                  Ce code est valable <strong style="color:#ffffff;">5 minutes</strong>. Si vous n'avez pas demande ce code, vous pouvez ignorer cet email en toute securite.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <div style="height:1px;background:rgba(255,255,255,0.06);margin-bottom:24px;"></div>

    <!-- Security note -->
    <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0;">
      Pour votre securite, ne partagez jamais ce code avec personne. L'equipe OptiRecipe ne vous demandera jamais votre code par telephone ou par message.
    </p>`;

  const html = emailLayout(content);

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${otp} — Votre code de connexion OptiRecipe`,
    html,
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

  const content = `
    <!-- Greeting -->
    <p style="color:#ffffff;font-size:18px;font-weight:600;margin:0 0 8px;letter-spacing:-0.2px;">
      Extraction terminee
    </p>
    <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 36px;">
      L'analyse de votre livre de recettes est terminee. Voici un resume des resultats.
    </p>

    <!-- Stats hero -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#111118;border:1px solid rgba(255,255,255,0.06);border-radius:16px;margin-bottom:28px;overflow:hidden;">
      <!-- Green top accent -->
      <tr>
        <td style="height:2px;background:linear-gradient(90deg,transparent 0%,#10B981 30%,#059669 70%,transparent 100%);"></td>
      </tr>
      <tr>
        <td align="center" style="padding:32px 24px 12px;">
          <span style="font-size:52px;font-weight:800;color:#10B981;letter-spacing:-1px;">${recipesExtracted}</span>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 24px 32px;">
          <span style="font-size:15px;color:#d1d5db;font-weight:500;">${recipesLabel}</span>
        </td>
      </tr>
    </table>

    <!-- Details table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(255,255,255,0.02);border-radius:12px;margin-bottom:36px;">
      <tr>
        <td style="padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#9ca3af;font-size:14px;">Livre</td>
              <td align="right" style="color:#ffffff;font-size:14px;font-weight:600;">${cookbookName}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#9ca3af;font-size:14px;">Pages analysees</td>
              <td align="right" style="color:#ffffff;font-size:14px;font-weight:600;">${totalPages}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#9ca3af;font-size:14px;">Statut</td>
              <td align="right">
                <span style="display:inline-block;background:rgba(16,185,129,0.12);color:#10B981;font-size:13px;font-weight:600;padding:4px 14px;border-radius:20px;">
                  Termine
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${appUrl}/recipes?status=all"
             style="display:inline-block;background:linear-gradient(135deg,#00B4E6 0%,#0066FF 100%);color:#ffffff;font-weight:600;font-size:15px;padding:16px 48px;border-radius:12px;text-decoration:none;letter-spacing:-0.2px;">
            Voir mes recettes
          </a>
        </td>
      </tr>
    </table>

    <!-- Spacer + tip -->
    <div style="height:28px;"></div>
    <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0;text-align:center;">
      Les recettes sont en attente de validation. Vous pouvez les approuver, modifier ou rejeter depuis l'application.
    </p>`;

  const html = emailLayout(content);

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${recipesExtracted} ${recipesLabel} de "${cookbookName}"`,
    html,
  });

  if (error) {
    console.error("[Email] Failed to send extraction email:", error);
    // Don't throw - extraction emails are non-critical
  } else {
    console.log(`[Email] Extraction complete email sent to ${to}`);
  }
}
