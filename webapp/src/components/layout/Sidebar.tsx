import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import {
  LayoutDashboard,
  Upload,
  BookOpen,
  ChefHat,
  Download,
  Settings,
  LogOut,
  Bell,
} from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";

const navigation = [
  { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { name: "Uploader", href: "/upload", icon: Upload },
  { name: "Livres", href: "/cookbooks", icon: BookOpen },
  { name: "Recettes", href: "/recipes", icon: ChefHat },
  { name: "Exporter", href: "/export", icon: Download },
];

export function Sidebar() {
  const location = useLocation();
  const { data: session } = useSession();
  const user = session?.user;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-72 lg:w-80 glass-sidebar animate-slide-left">
      <div className="flex h-full flex-col">
        {/* Logo Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-6">
            <Logo size="md" showText />
            <button className="icon-container p-2.5 rounded-lg transition-all duration-200 hover:scale-105">
              <Bell className="w-4 h-4 text-gray-300" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="glass-input flex items-center gap-3 rounded-xl px-4 py-3 text-sm group">
            <ChefHat className="w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-400"
            />
            <span className="text-xs text-gray-500 font-mono">⌘K</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          <div className="mb-8">
            <h3 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-4 px-3">
              Navigation
            </h3>
            <nav className="space-y-1.5">
              {navigation.map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    location.pathname.startsWith(item.href));

                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group",
                      isActive
                        ? "bg-primary/15 border border-primary/20 text-primary"
                        : "text-gray-300 hover:text-white hover:bg-white/[0.08]"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                        isActive && "text-primary"
                      )}
                    />
                    <span className="font-medium">{item.name}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Tools Section */}
          <div className="mb-6">
            <h3 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-4 px-3">
              Outils
            </h3>
            <nav className="space-y-1.5">
              <NavLink
                to="/settings"
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group",
                  location.pathname === "/settings"
                    ? "bg-primary/15 border border-primary/20 text-primary"
                    : "text-gray-300 hover:text-white hover:bg-white/[0.08]"
                )}
              >
                <Settings className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                <span className="font-medium">Paramètres</span>
              </NavLink>
            </nav>
          </div>

          {/* Recent Activity */}
          <div className="mb-6">
            <h3 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-4 px-3">
              Activité récente
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                <div className="w-2 h-2 rounded-full bg-success mt-2" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">Livre uploadé</p>
                  <p className="text-xs text-gray-500 mt-0.5">Il y a 3 min</p>
                </div>
              </div>
              <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">
                    Extraction en cours
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Il y a 18 min</p>
                </div>
              </div>
              <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                <div className="w-2 h-2 rounded-full bg-accent mt-2" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">
                    12 recettes extraites
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Il y a 1 heure</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-4 p-4 rounded-xl glass-card-static hover:bg-white/[0.08] transition-all duration-200 cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-white font-semibold text-lg">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-white truncate">
                {user?.name || "Utilisateur"}
              </p>
              <p className="text-sm text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
