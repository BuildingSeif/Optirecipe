import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassButton } from "@/components/ui/glass-button";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Loader2, Mail } from "lucide-react";
import { resolveBackendUrl } from "@/lib/api";

const BACKEND_URL = resolveBackendUrl();

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/otp/request-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await res.json();

      if (res.status === 403) {
        setError("Acces non autorise. Contactez l'administrateur.");
        return;
      }

      if (!res.ok || data.error) {
        setError(data.error?.message || data.message || "Une erreur est survenue. Veuillez reessayer.");
        return;
      }

      setSuccess("Code envoye!");
      setTimeout(() => {
        navigate("/verify-otp", { state: { email: email.trim().toLowerCase() } });
      }, 1000);
    } catch {
      setError("Impossible de contacter le serveur. Veuillez reessayer.");
    } finally {
      setIsLoading(false);
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
            <h1 className="text-2xl font-heading tracking-tight text-white">OptiRecipe</h1>
            <p className="text-white/45 mt-2">
              Connectez-vous a votre espace
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleRequestOtp} className="space-y-4">
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
                  className="w-full pl-10 pr-4 py-3 rounded-xl ct-input"
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

            {success ? (
              <p className="text-sm text-green-400 animate-fade-in">
                {success}
              </p>
            ) : null}

            <GlassButton
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                "Recevoir le code"
              )}
            </GlassButton>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/80">
          OptiRecipe par OptiMenu &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
