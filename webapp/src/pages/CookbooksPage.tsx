import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassButton } from "@/components/ui/glass-button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { BookOpen, Upload, ChefHat, Loader2 } from "lucide-react";

interface CookbookWithCount {
  id: string;
  name: string;
  status: string;
  totalPages: number | null;
  processedPages: number;
  createdAt: string;
  _count: { recipes: number };
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    uploaded: { label: "Uploade", className: "badge-pending" },
    processing: { label: "En cours", className: "badge-processing" },
    completed: { label: "Termine", className: "badge-completed" },
    failed: { label: "Echoue", className: "badge-failed" },
  };
  const variant = variants[status] || { label: status, className: "" };
  return <Badge variant="outline" className={variant.className}>{variant.label}</Badge>;
}

export default function CookbooksPage() {
  const { data: cookbooks, isLoading } = useQuery({
    queryKey: ["cookbooks"],
    queryFn: () => api.get<CookbookWithCount[]>("/api/cookbooks"),
  });

  return (
    <DashboardLayout
      title="Livres"
      subtitle={`${cookbooks?.length || 0} livres au total`}
      breadcrumbs={[
        { label: "Accueil", href: "/dashboard" },
        { label: "Livres" },
      ]}
      rightContent={
        <GlassButton asChild size="sm" variant="primary">
          <Link to="/upload">
            <Upload className="mr-2 h-4 w-4" />
            Uploader
          </Link>
        </GlassButton>
      }
    >
      <div className="space-y-6">
        {/* Section heading */}
        <h2 className="text-white font-heading text-lg">Tous les livres</h2>

        {/* Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : cookbooks && cookbooks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cookbooks.map((cookbook) => (
              <Link
                key={cookbook.id}
                to={`/cookbooks/${cookbook.id}`}
                className="ct-card ct-card-hover p-5 block"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{cookbook.name}</p>
                    <StatusBadge status={cookbook.status} />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-white/40">
                  <span><ChefHat className="h-3 w-3 inline mr-1" />{cookbook._count.recipes} recettes</span>
                  {cookbook.status === "processing" && cookbook.totalPages ? (
                    <span className="text-primary">
                      {cookbook.processedPages}/{cookbook.totalPages} pages
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="ct-card rounded-xl text-center py-12">
            <BookOpen className="h-10 w-10 mx-auto text-gray-500 mb-4" />
            <p className="text-gray-400 mb-4">Aucun livre</p>
            <GlassButton asChild size="sm" variant="primary">
              <Link to="/upload">Uploader un livre</Link>
            </GlassButton>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
