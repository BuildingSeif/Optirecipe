import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
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
    uploaded: { label: "Uploadé", className: "bg-muted text-muted-foreground" },
    processing: { label: "En cours", className: "bg-primary/10 text-primary" },
    completed: { label: "Terminé", className: "bg-success/10 text-success" },
    failed: { label: "Échoué", className: "bg-destructive/10 text-destructive" },
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
      description="Gérez vos livres de recettes importés"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{cookbooks?.length || 0} livres</Badge>
          </div>
          <Button asChild>
            <Link to="/upload">
              <Upload className="mr-2 h-4 w-4" />
              Uploader
            </Link>
          </Button>
        </div>

        {/* Cookbooks Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : cookbooks && cookbooks.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cookbooks.map((cookbook) => (
              <Link key={cookbook.id} to={`/cookbooks/${cookbook.id}`}>
                <Card className="card-hover h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <BookOpen className="h-6 w-6 text-primary" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
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

                    <h3 className="font-semibold text-lg mb-1 line-clamp-1">{cookbook.name}</h3>
                    <StatusBadge status={cookbook.status} />

                    {/* Progress for processing */}
                    {cookbook.status === "processing" && cookbook.totalPages && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Progression</span>
                          <span>
                            {cookbook.processedPages}/{cookbook.totalPages} pages
                          </span>
                        </div>
                        <Progress
                          value={(cookbook.processedPages / cookbook.totalPages) * 100}
                        />
                      </div>
                    )}

                    {/* Stats */}
                    <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <ChefHat className="h-4 w-4" />
                        <span>{cookbook._count.recipes} recettes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(cookbook.createdAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucun livre uploadé</h3>
              <p className="text-muted-foreground text-center mb-4">
                Commencez par uploader votre premier livre de recettes
              </p>
              <Button asChild>
                <Link to="/upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Uploader un livre
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
