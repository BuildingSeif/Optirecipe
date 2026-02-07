import { NavLink, useLocation, Link } from "react-router-dom";
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
} from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";

const navigation = [
  { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { name: "Uploader", href: "/upload", icon: Upload },
  { name: "Livres", href: "/cookbooks", icon: BookOpen },
  { name: "Recettes", href: "/recipes", icon: ChefHat },
  { name: "Exporter", href: "/export", icon: Download },
  { name: "Parametres", href: "/settings", icon: Settings },
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
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-gradient-to-b from-[#0a1628] via-[#0d1f3c] to-[#091525] border-r border-primary/20 animate-slide-left shadow-xl shadow-primary/5">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="p-6">
          <Logo size="md" showText />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
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
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-primary text-white font-semibold shadow-lg shadow-primary/30"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-primary/20">
          <div className="flex items-center gap-3 px-2">
            <Link to="/settings" className="flex-shrink-0">
              {user?.image ? (
                <img
                  src={user.image}
                  alt={user.name || "Profile"}
                  className="w-10 h-10 rounded-full object-cover border-2 border-primary/30 hover:border-primary/60 transition-colors"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center hover:from-primary/80 hover:to-accent/80 transition-colors">
                  <span className="text-white font-semibold text-sm">{initials}</span>
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user?.name || "Utilisateur"}
              </p>
              <p className="text-xs text-white/60 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="Deconnexion"
            >
              <LogOut className="w-4 h-4 text-white/70 hover:text-white" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
