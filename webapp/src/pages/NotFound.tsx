import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="ambient-orbs absolute inset-0 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="glass-card-static p-8 rounded-2xl animate-blur-in max-w-md w-full text-center">
          <div className="icon-container p-4 rounded-2xl mx-auto w-fit mb-6">
            <AlertCircle className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-6xl font-bold text-white mb-4">404</h1>
          <p className="text-xl text-gray-400 mb-6">
            Oups ! Page non trouvee
          </p>
          <p className="text-gray-500 mb-8">
            La page que vous recherchez n'existe pas ou a ete deplacee.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Retour a l'accueil
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
