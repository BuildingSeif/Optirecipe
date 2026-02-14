import { memo, useCallback } from "react";
import { NavLink, useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  BookOpen,
  ChefHat,
  Download,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const navigation = [
  { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { name: "Uploader", href: "/upload", icon: Upload },
  { name: "Livres", href: "/cookbooks", icon: BookOpen },
  { name: "Recettes", href: "/recipes", icon: ChefHat },
  { name: "Exporter", href: "/export", icon: Download },
  { name: "Parametres", href: "/settings", icon: Settings },
];

// Memoized nav item to prevent unnecessary re-renders
const NavItem = memo(function NavItem({
  item,
  isActive,
}: {
  item: (typeof navigation)[0];
  isActive: boolean;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.href}
      className={cn(
        "sidebar-nav-item",
        isActive && "sidebar-nav-item-active"
      )}
    >
      <Icon className="w-[18px] h-[18px]" />
      <span>{item.name}</span>
    </NavLink>
  );
});

// Memoized user section
const UserSection = memo(function UserSection({
  user,
  onSignOut,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null } | null | undefined;
  onSignOut: () => void;
}) {
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="p-4 border-t border-white/[0.06]">
      <div className="flex items-center gap-3 px-1">
        <Link to="/settings" className="flex-shrink-0">
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name || "Profile"}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-white/10 hover:ring-white/25 transition-all"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center ring-2 ring-white/10 hover:ring-white/25 transition-all">
              <span className="text-white/80 font-semibold text-xs">{initials}</span>
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/90 truncate">
            {user?.name || "Utilisateur"}
          </p>
          <p className="text-[11px] text-white/40 truncate">{user?.email}</p>
        </div>
        <button
          onClick={onSignOut}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          title="Deconnexion"
        >
          <LogOut className="w-4 h-4 text-white/40 hover:text-white/70" />
        </button>
      </div>
    </div>
  );
});

export const Sidebar = memo(function Sidebar() {
  const location = useLocation();
  const { session, signOut } = useAuth();
  const user = session?.user;

  const handleSignOut = useCallback(async () => {
    await signOut();
    window.location.href = "/login";
  }, [signOut]);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[240px] bg-black/50 backdrop-blur-xl border-r border-white/[0.06]">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="px-5 py-6">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="OptiRecipe" className="w-8 h-8 object-contain" />
            <div>
              <span className="text-[15px] font-bold tracking-tight font-heading">
                <span className="text-white">Opti</span>
                <span className="text-primary">Recipe</span>
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navigation.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== "/dashboard" &&
                location.pathname.startsWith(item.href));

            return <NavItem key={item.name} item={item} isActive={isActive} />;
          })}
        </nav>

        {/* User */}
        <UserSection user={user} onSignOut={handleSignOut} />
      </div>
    </aside>
  );
});
