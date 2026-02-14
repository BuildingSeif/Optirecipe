import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { GlassButton } from "@/components/ui/glass-button";
import { Loader2, Mail, ArrowLeft } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();

  const email = location.state?.email as string | undefined;

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState("");

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (!email) return;
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [email]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Redirect to login if no email in state
  if (!email) {
    return <Navigate to="/login" replace />;
  }

  const submitCode = async (code: string) => {
    setError("");
    setIsVerifying(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/otp/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(
          data.error?.message || data.message || "Code invalide. Veuillez reessayer."
        );
        return;
      }

      if (data.user && data.token) {
        setSession({ user: data.user, session: { token: data.token } });
        navigate("/dashboard", { replace: true });
        return;
      }

      setError("Reponse inattendue du serveur. Veuillez reessayer.");
    } catch {
      setError("Impossible de contacter le serveur. Veuillez reessayer.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError("");

    // Auto-focus next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (digit && index === OTP_LENGTH - 1) {
      const code = newDigits.join("");
      if (code.length === OTP_LENGTH) {
        submitCode(code);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // If current input is empty, focus previous and clear it
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
        e.preventDefault();
      }
    }

    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
      e.preventDefault();
    }

    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (pasted.length === 0) return;

    const newDigits = [...digits];
    for (let i = 0; i < OTP_LENGTH; i++) {
      newDigits[i] = pasted[i] || "";
    }
    setDigits(newDigits);
    setError("");

    // Focus the input after last pasted digit, or the last input
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();

    // Auto-submit if all 6 digits pasted
    if (pasted.length === OTP_LENGTH) {
      submitCode(pasted);
    }
  };

  const handleVerifyClick = (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== OTP_LENGTH) {
      setError("Veuillez entrer les 6 chiffres du code.");
      return;
    }
    submitCode(code);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setError("");
    setResendMessage("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/otp/request-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(
          data.error?.message || data.message || "Impossible de renvoyer le code."
        );
        return;
      }

      setResendMessage("Un nouveau code a ete envoye.");
      setResendCooldown(RESEND_COOLDOWN);
      // Clear the current digits
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch {
      setError("Impossible de contacter le serveur. Veuillez reessayer.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="p-8 rounded-2xl animate-slide-up ct-card ct-card-glow">
          {/* Header */}
          <div className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-heading tracking-tight text-white">
              Verification du code
            </h1>
            <div className="flex items-center justify-center gap-2 mt-3">
              <Mail className="h-4 w-4 text-white/45" />
              <p className="text-white/45 text-sm">
                Code envoye a <span className="text-white/70 font-medium">{email}</span>
              </p>
            </div>
          </div>

          {/* OTP Form */}
          <form onSubmit={handleVerifyClick} className="space-y-6">
            {/* Digit Inputs */}
            <div className="flex justify-center gap-3" onPaste={handlePaste}>
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold rounded-xl ct-input focus:ring-2 focus:ring-primary/50 transition-all"
                  disabled={isVerifying}
                  aria-label={`Chiffre ${index + 1}`}
                />
              ))}
            </div>

            {/* Error Message */}
            {error ? (
              <p className="text-sm text-red-400 text-center animate-fade-in">
                {error}
              </p>
            ) : null}

            {/* Resend Success Message */}
            {resendMessage ? (
              <p className="text-sm text-green-400 text-center animate-fade-in">
                {resendMessage}
              </p>
            ) : null}

            {/* Verify Button */}
            <GlassButton
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verification...
                </>
              ) : (
                "Verifier"
              )}
            </GlassButton>

            {/* Resend Button */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isResending}
                className="text-sm text-white/45 hover:text-white/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isResending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Envoi en cours...
                  </span>
                ) : resendCooldown > 0 ? (
                  `Renvoyer le code (${resendCooldown}s)`
                ) : (
                  "Renvoyer le code"
                )}
              </button>
            </div>
          </form>

          {/* Back to login */}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-6 flex items-center justify-center gap-2 w-full text-sm text-white/45 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour a la connexion
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-white/80">
          OptiRecipe par OptiMenu &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
