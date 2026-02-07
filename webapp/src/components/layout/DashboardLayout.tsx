import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 text-white">
      <Sidebar />
      <div className="pl-64">
        <Header title={title} />
        <main className="px-8 pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
