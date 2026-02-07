import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 text-white relative overflow-x-hidden">
      {/* Ambient floating elements */}
      <div className="fixed inset-0 -z-10 ambient-orbs pointer-events-none" />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="pl-72 lg:pl-80">
        <Header title={title} description={description} />
        <main className="p-6 lg:p-8 animate-blur-in">
          {children}
        </main>
      </div>
    </div>
  );
}
