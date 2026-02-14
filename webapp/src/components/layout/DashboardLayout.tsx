import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  rightContent?: React.ReactNode;
}

export function DashboardLayout({ children, title, subtitle, breadcrumbs, rightContent }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen text-white relative">
      {/* Content - background is now persistent in App.tsx */}
      <div className="relative z-10">
        <Sidebar />
        <div className="pl-[240px]">
          <Header
            title={title}
            subtitle={subtitle}
            breadcrumbs={breadcrumbs}
            rightContent={rightContent}
          />
          <main className="px-8 pb-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
