import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import {
  BookOpen,
  ChefHat,
  Clock,
  CheckCircle2,
  Upload,
  ArrowRight,
  Loader2,
} from "lucide-react";
import type { DashboardStats, ProcessingJob, Recipe } from "../../../backend/src/types";

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
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
    { title: "Livres", value: stats?.totalCookbooks ?? 0, icon: BookOpen },
    { title: "Recettes", value: stats?.totalRecipes ?? 0, icon: ChefHat },
    { title: "En attente", value: stats?.pendingRecipes ?? 0, icon: Clock },
    { title: "Approuvees", value: stats?.approvedRecipes ?? 0, icon: CheckCircle2 },
  ];

  return (
    <DashboardLayout title={`Bonjour, ${userName}`}>
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <div key={stat.title} className="glass-card-static p-5 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <stat.icon className="w-5 h-5 text-primary" />
                <span className="text-gray-400 text-sm">{stat.title}</span>
              </div>
              <p className="text-2xl font-semibold text-white">
                {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Quick Action */}
        <div className="flex justify-center">
          <Button asChild size="lg" className="gradient-primary px-8">
            <Link to="/upload">
              <Upload className="mr-2 h-5 w-5" />
              Uploader un livre
            </Link>
          </Button>
        </div>

        {/* Recent Activity */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Jobs */}
          <div className="glass-card-static p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Livres recents</h3>
              <Link to="/cookbooks" className="text-primary text-sm flex items-center gap-1">
                Voir tout <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {recentLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              </div>
            ) : recent?.recentJobs && recent.recentJobs.length > 0 ? (
              <div className="space-y-3">
                {recent.recentJobs.slice(0, 4).map((job) => (
                  <Link
                    key={job.id}
                    to={`/cookbooks/${job.cookbookId}`}
                    className="flex items-center justify-between py-2 hover:bg-white/5 rounded-lg px-2 -mx-2"
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-4 h-4 text-gray-500" />
                      <span className="text-white text-sm truncate max-w-[180px]">
                        {job.cookbook?.name || "Livre"}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(job.createdAt)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8 text-sm">Aucun livre</p>
            )}
          </div>

          {/* Recent Recipes */}
          <div className="glass-card-static p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Recettes recentes</h3>
              <Link to="/recipes" className="text-primary text-sm flex items-center gap-1">
                Voir tout <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {recentLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              </div>
            ) : recent?.recentRecipes && recent.recentRecipes.length > 0 ? (
              <div className="space-y-3">
                {recent.recentRecipes.slice(0, 4).map((recipe) => (
                  <Link
                    key={recipe.id}
                    to={`/recipes/${recipe.id}`}
                    className="flex items-center justify-between py-2 hover:bg-white/5 rounded-lg px-2 -mx-2"
                  >
                    <div className="flex items-center gap-3">
                      <ChefHat className="w-4 h-4 text-gray-500" />
                      <span className="text-white text-sm truncate max-w-[180px]">
                        {recipe.title}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{recipe.category || "-"}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8 text-sm">Aucune recette</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
