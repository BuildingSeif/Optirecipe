import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import {
  BookOpen,
  ChefHat,
  Clock,
  CheckCircle2,
  XCircle,
  Upload,
  ArrowRight,
  Loader2,
} from "lucide-react";
import type { DashboardStats, ProcessingJob, Recipe } from "../../../backend/src/types";

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    pending: { label: "En attente", className: "badge-pending" },
    processing: { label: "En cours", className: "badge-processing" },
    completed: { label: "Terminé", className: "badge-completed" },
    failed: { label: "Échoué", className: "badge-failed" },
    approved: { label: "Approuvée", className: "badge-approved" },
    rejected: { label: "Rejetée", className: "badge-rejected" },
    needs_review: { label: "À revoir", className: "badge-pending" },
    uploaded: { label: "Uploadé", className: "badge-pending" },
  };

  const variant = variants[status] || { label: status, className: "" };

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name?.split(" ")[0] || "Utilisateur";

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.get<DashboardStats>("/api/stats"),
  });

  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: () =>
      api.get<{ recentJobs: ProcessingJob[]; recentRecipes: Recipe[] }>("/api/stats/recent"),
  });

  const statCards = [
    {
      title: "Livres uploadés",
      value: stats?.totalCookbooks ?? 0,
      icon: BookOpen,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Recettes extraites",
      value: stats?.totalRecipes ?? 0,
      icon: ChefHat,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "En attente de validation",
      value: stats?.pendingRecipes ?? 0,
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Recettes approuvées",
      value: stats?.approvedRecipes ?? 0,
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  return (
    <DashboardLayout title={`Bonjour, ${userName}`} description="Bienvenue sur OptiRecipe">
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat, index) => (
            <Card key={stat.title} className="card-hover" style={{ animationDelay: `${index * 50}ms` }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1">
                      {statsLoading ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        stat.value.toLocaleString("fr-FR")
                      )}
                    </p>
                  </div>
                  <div className={`rounded-lg p-3 ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions rapides</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/upload">
                <Upload className="mr-2 h-4 w-4" />
                Uploader un livre
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/recipes">
                <ChefHat className="mr-2 h-4 w-4" />
                Voir les recettes
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/export">
                <ArrowRight className="mr-2 h-4 w-4" />
                Exporter
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Jobs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Activité récente</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/cookbooks">
                  Voir tout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : recent?.recentJobs && recent.recentJobs.length > 0 ? (
                <div className="space-y-3">
                  {recent.recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{job.cookbook?.name || "Livre"}</p>
                          <p className="text-xs text-muted-foreground">
                            {job.recipesExtracted} recettes • {formatDate(job.createdAt)}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">Aucune activité récente</p>
                  <Button variant="link" size="sm" asChild className="mt-2">
                    <Link to="/upload">Commencer en uploadant un livre</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Recipes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recettes récentes</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/recipes">
                  Voir tout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : recent?.recentRecipes && recent.recentRecipes.length > 0 ? (
                <div className="space-y-3">
                  {recent.recentRecipes.slice(0, 5).map((recipe) => (
                    <Link
                      key={recipe.id}
                      to={`/recipes/${recipe.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <ChefHat className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{recipe.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {recipe.category || "Non catégorisé"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={recipe.status} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ChefHat className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">Aucune recette</p>
                  <Button variant="link" size="sm" asChild className="mt-2">
                    <Link to="/upload">Extraire des recettes d'un livre</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
