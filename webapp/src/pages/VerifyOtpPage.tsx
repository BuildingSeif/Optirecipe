import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Loader2, ArrowLeft, KeyRound } from "lucide-react";

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email as string | undefined;

  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if no email in state
  if (!email) {
    return <Navigate to="/login" replace />;
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp,
      });

      if (result.error) {
        setError(result.error.message || "Code de vérification invalide");
      } else {
        navigate("/dashboard");
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError("");
    setIsLoading(true);

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "sign-in",
      });

      if (result.error) {
        setError(result.error.message || "Échec de l'envoi du code");
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 p-4 relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="ambient-orbs fixed inset-0 pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="glass-card-static p-8 rounded-2xl max-w-md w-full animate-slide-up">
          {/* Header */}
          <div className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-semibold text-white">Vérification</h1>
            <p className="text-gray-400 mt-2">
              Entrez le code envoyé à<br />
              <span className="font-medium text-white">{email}</span>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-gray-400">Code de vérification</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="glass-input pl-10 text-center text-lg tracking-widest text-white placeholder:text-gray-500"
                  maxLength={6}
                  required
                  disabled={isLoading}
                  autoComplete="one-time-code"
                />
              </div>
            </div>

            {error ? (
              <p className="text-sm text-red-400 animate-fade-in">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="gradient-primary w-full text-white font-medium"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Vérification...
                </>
              ) : (
                "Confirmer"
              )}
            </Button>
          </form>

          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="ghost"
              className="w-full text-gray-400 hover:text-white hover:bg-white/10"
              onClick={handleResendOTP}
              disabled={isLoading}
            >
              Renvoyer le code
            </Button>

            <Button
              variant="ghost"
              className="w-full text-gray-400 hover:text-white hover:bg-white/10"
              onClick={() => navigate("/login")}
              disabled={isLoading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          OptiRecipe par OptiMenu &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
