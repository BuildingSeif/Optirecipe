import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen text-white relative">
      {/* Content - background is now persistent in App.tsx */}
      <div className="relative z-10">
        <Sidebar />
        <div className="pl-64">
          <Header title={title} />
          <main className="px-8 pb-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
