import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Loader2, Mail } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      });

      if (result.error) {
        setError(result.error.message || "Échec de l'envoi du code");
      } else {
        navigate("/verify-otp", { state: { email: normalizedEmail } });
      }
    } catch (err: unknown) {
      console.error("OTP send failed via authClient, trying direct fetch:", err);

      // Fallback: call the API directly if Better Auth client throws
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL;
        const res = await fetch(`${backendUrl}/api/auth/email-otp/send-verification-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: normalizedEmail, type: "sign-in" }),
        });

        if (res.ok) {
          navigate("/verify-otp", { state: { email: normalizedEmail } });
        } else {
          const data = await res.json().catch(() => null);
          setError(data?.message || "Échec de l'envoi du code de vérification");
        }
      } catch (fetchErr) {
        console.error("Direct fetch also failed:", fetchErr);
        setError("Impossible de contacter le serveur. Veuillez réessayer.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="p-8 rounded-2xl animate-slide-up backdrop-blur-xl bg-black/60 border border-white/10 shadow-2xl">
          {/* Header */}
          <div className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-semibold text-white animate-blur-in">OptiRecipe</h1>
            <p className="text-gray-400 mt-2">
              Connectez-vous pour accéder à votre espace
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Adresse email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-white placeholder:text-gray-500 bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none transition-colors"
                  required
                  disabled={isLoading}
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
              className="w-full gradient-primary text-white font-medium py-3 rounded-lg hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                "Recevoir le code de connexion"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-300">
            Un code de vérification sera envoyé à votre adresse email
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-white/80">
          OptiRecipe par OptiMenu &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
