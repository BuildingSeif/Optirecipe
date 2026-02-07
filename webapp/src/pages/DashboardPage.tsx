import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
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
  TrendingUp,
  Sparkles,
  Zap,
  Target,
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
      trend: "+12%",
      trendUp: true,
    },
    {
      title: "Recettes extraites",
      value: stats?.totalRecipes ?? 0,
      icon: ChefHat,
      color: "text-accent",
      trend: "+24%",
      trendUp: true,
    },
    {
      title: "En attente",
      value: stats?.pendingRecipes ?? 0,
      icon: Clock,
      color: "text-warning",
      trend: "-8%",
      trendUp: false,
    },
    {
      title: "Approuvées",
      value: stats?.approvedRecipes ?? 0,
      icon: CheckCircle2,
      color: "text-success",
      trend: "+18%",
      trendUp: true,
    },
  ];

  return (
    <DashboardLayout title={`Bonjour, ${userName}`} description="Bienvenue sur OptiRecipe">
      <div className="space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <div
              key={stat.title}
              className="glass-card p-6 rounded-2xl group"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="icon-container p-3 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <span
                  className={`text-sm font-semibold ${
                    stat.trendUp ? "text-success" : "text-destructive"
                  }`}
                >
                  {stat.trend}
                </span>
              </div>
              <h3 className="text-3xl font-bold text-white mb-1">
                {statsLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  stat.value.toLocaleString("fr-FR")
                )}
              </h3>
              <p className="text-gray-400">{stat.title}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="glass-card-static p-8 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">Actions rapides</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-success font-medium">En ligne</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              to="/upload"
              className="glass-card p-6 rounded-xl hover:scale-105 transition-all duration-200 cursor-pointer group"
            >
              <Upload className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h4 className="text-lg font-semibold text-white mb-2">Uploader un livre</h4>
              <p className="text-gray-400 text-sm">
                Téléchargez un PDF de livre de cuisine pour extraction
              </p>
            </Link>

            <Link
              to="/recipes"
              className="glass-card p-6 rounded-xl hover:scale-105 transition-all duration-200 cursor-pointer group"
            >
              <Zap className="w-8 h-8 text-accent mb-4 group-hover:scale-110 transition-transform" />
              <h4 className="text-lg font-semibold text-white mb-2">Voir les recettes</h4>
              <p className="text-gray-400 text-sm">
                Consultez et validez les recettes extraites
              </p>
            </Link>

            <Link
              to="/export"
              className="glass-card p-6 rounded-xl hover:scale-105 transition-all duration-200 cursor-pointer group"
            >
              <Target className="w-8 h-8 text-success mb-4 group-hover:scale-110 transition-transform" />
              <h4 className="text-lg font-semibold text-white mb-2">Exporter</h4>
              <p className="text-gray-400 text-sm">
                Exportez vos recettes vers OptiMenu
              </p>
            </Link>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Recent Jobs */}
          <div className="glass-card-static p-8 rounded-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-white">Activité récente</h3>
              <Link
                to="/cookbooks"
                className="text-primary hover:text-primary/80 font-medium flex items-center gap-2 hover:scale-105 transition-all duration-200"
              >
                Voir tout
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {recentLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : recent?.recentJobs && recent.recentJobs.length > 0 ? (
              <div className="space-y-4">
                {recent.recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{job.cookbook?.name || "Livre"}</p>
                        <p className="text-sm text-gray-400">
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
                <BookOpen className="h-10 w-10 mx-auto text-gray-500" />
                <p className="mt-2 text-gray-400">Aucune activité récente</p>
                <Link
                  to="/upload"
                  className="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80 font-medium"
                >
                  Commencer en uploadant un livre
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>

          {/* Recent Recipes */}
          <div className="glass-card-static p-8 rounded-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-white">Recettes récentes</h3>
              <Link
                to="/recipes"
                className="text-primary hover:text-primary/80 font-medium flex items-center gap-2 hover:scale-105 transition-all duration-200"
              >
                Voir tout
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {recentLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : recent?.recentRecipes && recent.recentRecipes.length > 0 ? (
              <div className="space-y-4">
                {recent.recentRecipes.slice(0, 5).map((recipe) => (
                  <Link
                    key={recipe.id}
                    to={`/recipes/${recipe.id}`}
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                        <ChefHat className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{recipe.title}</p>
                        <p className="text-sm text-gray-400">
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
                <ChefHat className="h-10 w-10 mx-auto text-gray-500" />
                <p className="mt-2 text-gray-400">Aucune recette</p>
                <Link
                  to="/upload"
                  className="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80 font-medium"
                >
                  Extraire des recettes d'un livre
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* AI Assistant Section */}
        <div className="glass-card-static p-8 rounded-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="icon-container p-3 rounded-xl">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">Assistant IA</h3>
              <p className="text-gray-400">Extraction intelligente de recettes avec IA</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-success font-medium">Actif</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-xl hover:scale-105 transition-all duration-200 cursor-pointer group">
              <TrendingUp className="w-8 h-8 text-warning mb-4 group-hover:scale-110 transition-transform" />
              <h4 className="text-lg font-semibold text-white mb-2">Extraction automatique</h4>
              <p className="text-gray-400 text-sm">
                L'IA détecte et extrait automatiquement les recettes
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl hover:scale-105 transition-all duration-200 cursor-pointer group">
              <Zap className="w-8 h-8 text-accent mb-4 group-hover:scale-110 transition-transform" />
              <h4 className="text-lg font-semibold text-white mb-2">OCR avancé</h4>
              <p className="text-gray-400 text-sm">
                Reconnaissance de texte même sur les scans de mauvaise qualité
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl hover:scale-105 transition-all duration-200 cursor-pointer group">
              <Target className="w-8 h-8 text-success mb-4 group-hover:scale-110 transition-transform" />
              <h4 className="text-lg font-semibold text-white mb-2">Validation assistée</h4>
              <p className="text-gray-400 text-sm">
                Suggestions intelligentes pour valider les recettes
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
