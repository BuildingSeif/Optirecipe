import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { AlertCircle, Home } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen relative z-10 flex items-center justify-center p-6">
      <div className="ct-card ct-card-glow p-8 rounded-2xl animate-blur-in max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-6xl font-bold text-white font-heading tracking-tight mb-4">404</h1>
        <p className="text-xl text-white/60 mb-3 font-heading">
          Page non trouvee
        </p>
        <p className="text-white/40 text-sm mb-8">
          La page que vous recherchez n'existe pas ou a ete deplacee.
        </p>
        <GlassButton asChild size="lg" variant="primary" className="w-full">
          <Link to="/">
            <Home className="mr-2 h-4 w-4" />
            Retour a l'accueil
          </Link>
        </GlassButton>
      </div>
    </div>
  );
};

export default NotFound;
