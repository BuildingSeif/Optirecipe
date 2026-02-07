import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import {
  BookOpen,
  Upload,
  ChefHat,
  Calendar,
  Loader2,
  MoreVertical,
  Trash2,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CookbookWithCount {
  id: string;
  name: string;
  status: string;
  totalPages: number | null;
  processedPages: number;
  totalRecipesFound: number;
  createdAt: string;
  _count: {
    recipes: number;
  };
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    uploaded: { label: "Uploade", className: "badge-pending" },
    processing: { label: "En cours", className: "badge-processing" },
    completed: { label: "Termine", className: "badge-completed" },
    failed: { label: "Echoue", className: "badge-failed" },
  };

  const variant = variants[status] || { label: status, className: "" };

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

export default function CookbooksPage() {
  const { data: cookbooks, isLoading } = useQuery({
    queryKey: ["cookbooks"],
    queryFn: () => api.get<CookbookWithCount[]>("/api/cookbooks"),
  });

  return (
    <DashboardLayout
      title="Livres de recettes"
      description="Gerez vos livres de recettes importes"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="glass-card-static p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-gray-400">{cookbooks?.length || 0} livres</Badge>
          </div>
          <Button asChild className="gradient-primary border-0">
            <Link to="/upload">
              <Upload className="mr-2 h-4 w-4" />
              Uploader
            </Link>
          </Button>
        </div>

        {/* Cookbooks Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : cookbooks && cookbooks.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cookbooks.map((cookbook) => (
              <Link key={cookbook.id} to={`/cookbooks/${cookbook.id}`}>
                <div className="glass-card p-6 rounded-2xl h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="icon-container p-3 rounded-xl">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Retraiter
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <h3 className="font-semibold text-lg mb-1 line-clamp-1 text-white">{cookbook.name}</h3>
                  <StatusBadge status={cookbook.status} />

                  {/* Progress for processing */}
                  {cookbook.status === "processing" && cookbook.totalPages ? (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-400">
                        <span>Progression</span>
                        <span>
                          {cookbook.processedPages}/{cookbook.totalPages} pages
                        </span>
                      </div>
                      <Progress
                        value={(cookbook.processedPages / cookbook.totalPages) * 100}
                      />
                    </div>
                  ) : null}

                  {/* Stats */}
                  <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <ChefHat className="h-4 w-4" />
                      <span>{cookbook._count.recipes} recettes</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(cookbook.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass-card-static rounded-2xl">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="icon-container p-4 rounded-xl mb-4">
                <BookOpen className="h-12 w-12 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium mb-2 text-white">Aucun livre uploade</h3>
              <p className="text-gray-400 text-center mb-4">
                Commencez par uploader votre premier livre de recettes
              </p>
              <Button asChild className="gradient-primary border-0">
                <Link to="/upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Uploader un livre
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
