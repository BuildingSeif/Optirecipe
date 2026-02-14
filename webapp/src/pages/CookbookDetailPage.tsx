import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  ChefHat,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
  AlertCircle,
  Pause,
  Play,
  StopCircle,
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

  const { data: cookbook, isLoading, isError, refetch } = useQuery({
    queryKey: ["cookbook", id],
    queryFn: () => api.get<CookbookDetail>(`/api/cookbooks/${id}`),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "processing" || data?.status === "paused" ? 2000 : false;
    },
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

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !cookbook) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <AlertCircle className="h-10 w-10 mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400 mb-4">Livre non trouve</p>
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

  const recipeStats = {
    total: cookbook.recipes?.length || 0,
    pending: cookbook.recipes?.filter((r) => r.status === "pending").length || 0,
    approved: cookbook.recipes?.filter((r) => r.status === "approved").length || 0,
    rejected: cookbook.recipes?.filter((r) => r.status === "rejected").length || 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/cookbooks">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent">{cookbook.name}</h1>
            <StatusBadge status={cookbook.status} />
          </div>
          {cookbook.status !== "processing" && cookbook.status !== "paused" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => reprocessMutation.mutate()}
              disabled={reprocessMutation.isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${reprocessMutation.isPending ? "animate-spin" : ""}`} />
              Retraiter
            </Button>
          )}
        </div>

        {/* Processing Progress */}
        {cookbook.status === "processing" && (
          <div className="glass-card-static p-5 rounded-xl space-y-4">
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
        )}

        {/* Paused State */}
        {cookbook.status === "paused" && cookbook.processingJobs?.[0] && (
          <div className="glass-card-static p-5 rounded-xl space-y-4">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleResume}
              disabled={resumeMutation.isPending}
              className="w-full"
            >
              <Play className="mr-2 h-3 w-3" />
              Reprendre l'extraction
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card-static p-4 rounded-xl text-center">
            <ChefHat className="h-5 w-5 mx-auto text-gray-400 mb-2" />
            <p className="text-xl font-semibold text-white">{recipeStats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="glass-card-static p-4 rounded-xl text-center">
            <Clock className="h-5 w-5 mx-auto text-warning mb-2" />
            <p className="text-xl font-semibold text-white">{recipeStats.pending}</p>
            <p className="text-xs text-gray-500">En attente</p>
          </div>
          <div className="glass-card-static p-4 rounded-xl text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-success mb-2" />
            <p className="text-xl font-semibold text-white">{recipeStats.approved}</p>
            <p className="text-xs text-gray-500">Approuvees</p>
          </div>
          <div className="glass-card-static p-4 rounded-xl text-center">
            <XCircle className="h-5 w-5 mx-auto text-destructive mb-2" />
            <p className="text-xl font-semibold text-white">{recipeStats.rejected}</p>
            <p className="text-xs text-gray-500">Rejetees</p>
          </div>
        </div>

        {/* Recipes List */}
        <div className="glass-card-static p-6 rounded-xl">
          <h2 className="text-lg font-semibold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent mb-4">Recettes</h2>
          {cookbook.recipes && cookbook.recipes.length > 0 ? (
            <div className="space-y-2">
              {cookbook.recipes.map((recipe) => (
                <Link
                  key={recipe.id}
                  to={`/recipes/${recipe.id}`}
                  className="flex items-center justify-between py-3 px-3 -mx-3 hover:bg-white/5 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <ChefHat className="h-4 w-4 text-gray-500" />
                    <span className="text-white text-sm">{recipe.title}</span>
                  </div>
                  <StatusBadge status={recipe.status} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8 text-sm">Aucune recette</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
