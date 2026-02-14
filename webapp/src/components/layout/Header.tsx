import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface HeaderProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  rightContent?: React.ReactNode;
}

export function Header({ title, subtitle, breadcrumbs, rightContent }: HeaderProps) {
  return (
    <header className="px-8 pt-6 pb-4">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 mb-2 text-[13px]">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="w-3 h-3 text-white/25" />}
              {crumb.href ? (
                <Link
                  to={crumb.href}
                  className="text-white/40 hover:text-white/70 transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-white/60">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-center justify-between">
        <div>
          {title && (
            <h1 className="text-2xl font-bold tracking-tight text-white font-heading">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm text-white/45 mt-0.5">{subtitle}</p>
          )}
        </div>
        {rightContent && <div>{rightContent}</div>}
      </div>
    </header>
  );
}
