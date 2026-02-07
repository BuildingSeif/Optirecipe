import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
    <DashboardLayout title="Livres">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{cookbooks?.length || 0} livres</span>
          <Button asChild size="sm">
            <Link to="/upload">
              <Upload className="mr-2 h-4 w-4" />
              Uploader
            </Link>
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : cookbooks && cookbooks.length > 0 ? (
          <div className="glass-card-static rounded-xl divide-y divide-white/5">
            {cookbooks.map((cookbook) => (
              <Link
                key={cookbook.id}
                to={`/cookbooks/${cookbook.id}`}
                className="flex items-center justify-between p-4 hover:bg-white/5"
              >
                <div className="flex items-center gap-4">
                  <BookOpen className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-white font-medium">{cookbook.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">
                        <ChefHat className="h-3 w-3 inline mr-1" />
                        {cookbook._count.recipes} recettes
                      </span>
                      {cookbook.status === "processing" && cookbook.totalPages && (
                        <span className="text-xs text-primary">
                          {cookbook.processedPages}/{cookbook.totalPages} pages
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <StatusBadge status={cookbook.status} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass-card-static rounded-xl text-center py-12">
            <BookOpen className="h-10 w-10 mx-auto text-gray-500 mb-4" />
            <p className="text-gray-400 mb-4">Aucun livre</p>
            <Button asChild size="sm">
              <Link to="/upload">Uploader un livre</Link>
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
