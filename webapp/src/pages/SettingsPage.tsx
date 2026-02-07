import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useSession, signOut } from "@/lib/auth-client";
import { User, Mail, LogOut } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <DashboardLayout title="Parametres">
      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <div className="glass-card-static p-8 rounded-2xl">
          <div className="mb-6">
            <h2 className="text-white text-xl font-bold">Profil</h2>
            <p className="text-gray-400">Informations de votre compte</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-gray-300 text-sm font-medium">Nom</label>
              <div className="glass-input flex items-center gap-3 rounded-xl px-4">
                <div className="icon-container p-2 rounded-lg">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="name"
                  value={user?.name || ""}
                  disabled
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-400 py-3"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-gray-300 text-sm font-medium">Email</label>
              <div className="glass-input flex items-center gap-3 rounded-xl px-4">
                <div className="icon-container p-2 rounded-lg">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-400 py-3"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="glass-card-static p-8 rounded-2xl">
          <div className="mb-6">
            <h2 className="text-white text-xl font-bold">Compte</h2>
            <p className="text-gray-400">Gerez votre session</p>
          </div>
          <Button
            variant="destructive"
            onClick={handleSignOut}
            className="hover:scale-105 transition-transform duration-200"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Se deconnecter
          </Button>
        </div>

        {/* About */}
        <div className="glass-card-static p-8 rounded-2xl">
          <div className="mb-6">
            <h2 className="text-white text-xl font-bold">A propos</h2>
          </div>
          <div className="text-sm text-gray-400 space-y-2">
            <p>
              <strong className="text-white">OptiRecipe</strong> est un outil professionnel d'extraction de recettes
              pour la restauration collective.
            </p>
            <p>
              Developpe par <strong className="text-white">OptiMenu</strong> pour le systeme 1000CHEFS.
            </p>
            <p className="text-xs text-gray-400">Version 1.0.0</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
