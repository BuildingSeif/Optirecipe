import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Spline 3D Background */}
      <div className="fixed inset-0 z-0">
        <iframe
          src="https://my.spline.design/celestialflowabstractdigitalform-ObUlVgj70g2y4bbx5vBKSfxN/"
          frameBorder="0"
          width="100%"
          height="100%"
          id="dashboard-spline"
          title="Background Animation"
          style={{ pointerEvents: "none" }}
        />
      </div>

      {/* Content */}
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
