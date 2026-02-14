import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassButton } from "@/components/ui/glass-button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  BookOpen,
  ChefHat,
  Clock,
  CheckCircle2,
  Upload,
  ArrowRight,
  Loader2,
  ClipboardCheck,
  Download,
  XCircle,
} from "lucide-react";
import type { DashboardStats, ProcessingJob, Recipe } from "../../../backend/src/types";

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function JobStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    processing: { label: "En cours", className: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    completed: { label: "Termine", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    failed: { label: "Echoue", className: "bg-red-500/20 text-red-300 border-red-500/30" },
    cancelled: { label: "Annule", className: "bg-red-500/20 text-red-300 border-red-500/30" },
    paused: { label: "En pause", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    pending: { label: "En attente", className: "bg-white/10 text-white/60 border-white/20" },
  };
  const c = config[status] || config.pending;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${c.className}`}>
      {c.label}
    </Badge>
  );
}

export default function DashboardPage() {
  const { session } = useAuth();
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
    { title: "Total Livres", value: stats?.totalCookbooks ?? 0, icon: BookOpen, bg: "bg-blue-500/15", iconColor: "text-blue-400" },
    { title: "Total Recettes", value: stats?.totalRecipes ?? 0, icon: ChefHat, bg: "bg-violet-500/15", iconColor: "text-violet-400" },
    { title: "En attente", value: stats?.pendingRecipes ?? 0, icon: Clock, bg: "bg-amber-500/15", iconColor: "text-amber-400" },
    { title: "Approuvees", value: stats?.approvedRecipes ?? 0, icon: CheckCircle2, bg: "bg-emerald-500/15", iconColor: "text-emerald-400" },
  ];

  const pendingCount = stats?.pendingRecipes ?? 0;

  return (
    <DashboardLayout
      title={`Bonjour, ${userName}`}
      breadcrumbs={[{ label: "Accueil" }]}
    >
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <div key={stat.title} className="ct-card ct-light-bar p-5">
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-[18px] h-[18px] ${stat.iconColor}`} />
                  </div>
                  <span className="text-white/50 text-sm">{stat.title}</span>
                </div>
                <p className="text-3xl font-bold text-white font-heading tracking-tight">
                  {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap justify-center gap-3">
          <GlassButton variant="primary" size="lg" asChild>
            <Link to="/upload">
              <Upload className="mr-2 h-4 w-4" />
              Uploader un livre
            </Link>
          </GlassButton>
          <GlassButton variant="warning" size="lg" asChild>
            <Link to="/recipes?status=pending">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Valider les recettes
              {pendingCount > 0 ? (
                <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold">
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          </GlassButton>
          <GlassButton variant="success" size="lg" asChild>
            <Link to="/export">
              <Download className="mr-2 h-4 w-4" />
              Exporter
            </Link>
          </GlassButton>
        </div>

        {/* Recent Activity */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Jobs */}
          <div className="ct-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-semibold text-white font-heading">Activite recente</h3>
              <Link to="/cookbooks" className="text-primary text-sm font-medium flex items-center gap-1 hover:text-primary/80">
                Voir tout <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {recentLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : recent?.recentJobs && recent.recentJobs.length > 0 ? (
              <div className="space-y-2">
                {recent.recentJobs.slice(0, 5).map((job) => (
                  <Link
                    key={job.id}
                    to={`/cookbooks/${job.cookbookId}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-white/5 rounded-lg px-3 -mx-3 transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">
                        {job.cookbook?.name || "Livre"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <JobStatusBadge status={job.status} />
                        {job.recipesExtracted > 0 ? (
                          <span className="text-[10px] text-white/40">
                            {job.recipesExtracted} recettes
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-xs text-white/40 flex-shrink-0">{formatDate(job.createdAt)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <BookOpen className="w-8 h-8 mx-auto text-white/20 mb-3" />
                <p className="text-white/50 text-sm">Aucune activite</p>
                <p className="text-white/30 text-xs mt-1">Uploadez un livre pour commencer</p>
              </div>
            )}
          </div>

          {/* Recent Recipes */}
          <div className="ct-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-semibold text-white font-heading">Dernieres recettes</h3>
              <Link to="/recipes" className="text-primary text-sm font-medium flex items-center gap-1 hover:text-primary/80">
                Voir tout <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {recentLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : recent?.recentRecipes && recent.recentRecipes.length > 0 ? (
              <div className="space-y-2">
                {recent.recentRecipes.slice(0, 5).map((recipe) => {
                  const statusColor =
                    recipe.status === "approved" ? "text-emerald-400"
                    : recipe.status === "rejected" ? "text-red-400"
                    : "text-amber-400";
                  const StatusIcon =
                    recipe.status === "approved" ? CheckCircle2
                    : recipe.status === "rejected" ? XCircle
                    : Clock;

                  return (
                    <Link
                      key={recipe.id}
                      to={`/recipes/${recipe.id}`}
                      className="flex items-center gap-3 py-2.5 hover:bg-white/5 rounded-lg px-3 -mx-3 transition-colors"
                    >
                      <StatusIcon className={`w-4 h-4 ${statusColor} flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{recipe.title}</p>
                      </div>
                      {recipe.category ? (
                        <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded flex-shrink-0">
                          {recipe.category}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <ChefHat className="w-8 h-8 mx-auto text-white/20 mb-3" />
                <p className="text-white/50 text-sm">Aucune recette</p>
                <p className="text-white/30 text-xs mt-1">Les recettes extraites apparaitront ici</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
