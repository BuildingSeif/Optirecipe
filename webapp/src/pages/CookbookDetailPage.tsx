import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { GlassButton } from "@/components/ui/glass-button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  AlertCircle,
  Pause,
  Play,
  StopCircle,
  Download,
  Trash2,
} from "lucide-react";
import type { Recipe, ProcessingJob } from "../../../backend/src/types";

interface CookbookDetail {
  id: string;
  name: string;
  filePath: string;
  fileSize: number | null;
  totalPages: number | null;
  status: string;
  processedPages: number;
  totalRecipesFound: number;
  errorMessage: string | null;
  createdAt: string;
  recipes: Recipe[];
  processingJobs: ProcessingJob[];
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    uploaded: { label: "Uploade", className: "badge-pending" },
    processing: { label: "En cours", className: "badge-processing" },
    paused: { label: "En pause", className: "badge-pending" },
    completed: { label: "Termine", className: "badge-completed" },
    failed: { label: "Echoue", className: "badge-failed" },
    cancelled: { label: "Annule", className: "badge-failed" },
    pending: { label: "En attente", className: "badge-pending" },
    approved: { label: "Approuvee", className: "badge-approved" },
    rejected: { label: "Rejetee", className: "badge-rejected" },
  };

  const variant = variants[status] || { label: status, className: "" };

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

export default function CookbookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: cookbook, isLoading, isError, refetch } = useQuery({
    queryKey: ["cookbook", id],
    queryFn: () => api.get<CookbookDetail>(`/api/cookbooks/${id}`),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "processing") return 5000;
      if (data?.status === "paused") return 15000;
      return false;
    },
    staleTime: 10000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const reprocessMutation = useMutation({
    mutationFn: () => api.post("/api/processing/start", { cookbookId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cookbook", id] });
    },
  });

  const latestJob = cookbook?.processingJobs?.[0];

  const pauseMutation = useMutation({
    mutationFn: () => api.post(`/api/processing/${latestJob?.id}/pause`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cookbook", id] }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/api/processing/${latestJob?.id}/cancel`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cookbook", id] }),
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.post(`/api/processing/${latestJob?.id}/resume`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cookbook", id] }),
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      const pendingRecipes = cookbook?.recipes?.filter((r: Recipe) => r.status === "pending") || [];
      if (pendingRecipes.length === 0) return;
      const ids = pendingRecipes.map((r: Recipe) => r.id);
      return api.patch<{ updated: number }>("/api/recipes/bulk/status", { ids, status: "approved" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cookbook", id] });
    },
  });

  const deleteCookbookMutation = useMutation({
    mutationFn: () => api.delete(`/api/cookbooks/${id}`),
    onSuccess: () => {
      navigate("/cookbooks");
    },
  });

  const handlePause = () => {
    if (latestJob) pauseMutation.mutate();
  };

  const handleCancel = () => {
    if (latestJob && window.confirm("Etes-vous sur de vouloir arreter l'extraction ?")) {
      cancelMutation.mutate();
    }
  };

  const handleResume = () => {
    if (latestJob) resumeMutation.mutate();
  };

  const breadcrumbs = [
    { label: "Accueil", href: "/dashboard" },
    { label: "Livres", href: "/cookbooks" },
    { label: cookbook?.name || "Livre" },
  ];

  if (isLoading) {
    return (
      <DashboardLayout
        title="Chargement..."
        breadcrumbs={breadcrumbs}
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !cookbook) {
    return (
      <DashboardLayout
        title="Livre non trouve"
        breadcrumbs={breadcrumbs}
      >
        <div className="text-center py-20">
          <AlertCircle className="h-10 w-10 mx-auto text-white/30 mb-4" />
          <p className="text-white/50 mb-4">Livre non trouve</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reessayer
            </Button>
            <Button size="sm" asChild>
              <Link to="/cookbooks">Retour</Link>
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const processingProgress = cookbook.totalPages
    ? (cookbook.processedPages / cookbook.totalPages) * 100
    : 0;

  const recipes = cookbook.recipes || [];

  const recipeStats = {
    total: recipes.length,
    pending: recipes.filter((r) => r.status === "pending").length,
    approved: recipes.filter((r) => r.status === "approved").length,
    rejected: recipes.filter((r) => r.status === "rejected").length,
  };

  const headerRightContent = (
    <div className="flex items-center gap-2">
      <StatusBadge status={cookbook.status} />
      {cookbook.status !== "processing" && cookbook.status !== "paused" ? (
        <GlassButton
          size="sm"
          onClick={() => reprocessMutation.mutate()}
          disabled={reprocessMutation.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${reprocessMutation.isPending ? "animate-spin" : ""}`} />
          Retraiter
        </GlassButton>
      ) : null}
    </div>
  );

  return (
    <DashboardLayout
      title={cookbook.name}
      subtitle={`${cookbook.totalPages || 0} pages`}
      breadcrumbs={breadcrumbs}
      rightContent={headerRightContent}
    >
      <div className="space-y-6">
        {/* Processing Progress */}
        {cookbook.status === "processing" ? (
          <div className="ct-card p-5 space-y-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-white">
                  Page {cookbook.processedPages} / {cookbook.totalPages}
                </span>
              </div>
              <span className="text-sm text-primary font-medium">
                {cookbook.totalRecipesFound} recettes
              </span>
            </div>
            <Progress value={processingProgress} className="h-1.5" />
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePause}
                disabled={pauseMutation.isPending}
                className="flex-1"
              >
                <Pause className="mr-2 h-3 w-3" />
                Mettre en pause
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="flex-1 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50"
              >
                <StopCircle className="mr-2 h-3 w-3" />
                Arreter
              </Button>
            </div>
          </div>
        ) : null}

        {/* Paused State */}
        {cookbook.status === "paused" && cookbook.processingJobs?.[0] ? (
          <div className="ct-card p-5 space-y-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Pause className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-white">
                  En pause - Page {cookbook.processedPages} / {cookbook.totalPages}
                </span>
              </div>
              <span className="text-sm text-amber-400 font-medium">
                {cookbook.totalRecipesFound} recettes
              </span>
            </div>
            <Progress value={processingProgress} className="h-1.5" />
            <GlassButton
              size="sm"
              onClick={handleResume}
              disabled={resumeMutation.isPending}
              variant="primary"
              className="w-full"
            >
              <Play className="mr-2 h-3 w-3" />
              Reprendre l'extraction
            </GlassButton>
          </div>
        ) : null}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="ct-card ct-light-bar p-4 text-center">
            <p className="text-2xl font-bold text-white font-heading">{recipeStats.total}</p>
            <p className="text-xs text-white/45 mt-1">Total recettes</p>
          </div>
          <div className="ct-card ct-light-bar p-4 text-center">
            <p className="text-2xl font-bold text-amber-400 font-heading">{recipeStats.pending}</p>
            <p className="text-xs text-white/45 mt-1">En attente</p>
          </div>
          <div className="ct-card ct-light-bar p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400 font-heading">{recipeStats.approved}</p>
            <p className="text-xs text-white/45 mt-1">Approuvees</p>
          </div>
          <div className="ct-card ct-light-bar p-4 text-center">
            <p className="text-2xl font-bold text-red-400 font-heading">{recipeStats.rejected}</p>
            <p className="text-xs text-white/45 mt-1">Rejetees</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {recipeStats.pending > 0 ? (
            <GlassButton
              variant="success"
              size="sm"
              onClick={() => {
                if (window.confirm(`Approuver les ${recipeStats.pending} recettes en attente ?`)) {
                  approveAllMutation.mutate();
                }
              }}
              disabled={approveAllMutation.isPending}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approuver toutes les recettes ({recipeStats.pending})
            </GlassButton>
          ) : null}
          <GlassButton variant="primary" size="sm" asChild>
            <Link to={`/export?cookbookId=${id}`}>
              <Download className="mr-2 h-4 w-4" />
              Exporter ce livre
            </Link>
          </GlassButton>
          <GlassButton
            variant="destructive"
            size="sm"
            onClick={() => {
              if (window.confirm("Supprimer ce livre et toutes ses recettes ? Cette action est irreversible.")) {
                deleteCookbookMutation.mutate();
              }
            }}
            disabled={deleteCookbookMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer ce livre
          </GlassButton>
        </div>

        {/* Recipes List */}
        {recipes.length > 0 ? (
          <div className="ct-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white font-heading">Recettes ({recipeStats.total})</h3>
            <div className="space-y-1">
              {recipes.map((recipe) => (
                <Link
                  key={recipe.id}
                  to={`/recipes/${recipe.id}`}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  <span className={`status-dot status-dot-${recipe.status}`} />
                  <span className="text-sm text-white font-medium truncate flex-1">{recipe.title}</span>
                  {recipe.category ? (
                    <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded">{recipe.category}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
