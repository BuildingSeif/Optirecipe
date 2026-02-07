import { useSession } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Search, Bookmark, Share } from "lucide-react";

interface HeaderProps {
  title?: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
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

  return (
    <header className="sticky top-0 z-30 glass-chrome h-16 px-6 animate-fade-in">
      <div className="flex items-center justify-between h-full">
        {/* Left side - Title */}
        <div className="flex items-center gap-6">
          <div>
            {title && (
              <h1 className="text-xl font-semibold text-white tracking-tight">
                {title}
              </h1>
            )}
            {description && (
              <p className="text-sm text-gray-400">{description}</p>
            )}
          </div>
        </div>

        {/* Center - Search (optional, can be hidden on mobile) */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="glass-input flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm w-full group">
            <Search className="w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-400"
            />
            <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2 text-gray-400">
          <button className="rounded-lg p-2.5 transition-all duration-200 hover:text-white hover:bg-white/10 hover:scale-105">
            <Bookmark className="w-5 h-5" />
          </button>
          <button className="rounded-lg p-2.5 transition-all duration-200 hover:text-white hover:bg-white/10 hover:scale-105">
            <Share className="w-5 h-5" />
          </button>
          <button className="rounded-lg p-2.5 transition-all duration-200 hover:text-white hover:bg-white/10 hover:scale-105 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse" />
          </button>

          {/* User Avatar */}
          <div className="flex items-center gap-3 ml-4 pl-4 border-l border-white/10">
            <Avatar className="h-9 w-9 ring-2 ring-white/10 hover:ring-primary/50 transition-all cursor-pointer">
              <AvatarImage src={user?.image || undefined} alt={user?.name || "User"} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:block">
              <p className="text-sm font-medium text-white">{user?.name || "Utilisateur"}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
