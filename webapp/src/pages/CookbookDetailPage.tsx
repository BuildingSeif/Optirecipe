import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  BookOpen,
  ChefHat,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
  FileText,
  AlertCircle,
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
  generateDescriptions: boolean;
  reformulateForCopyright: boolean;
  convertToGrams: boolean;
  createdAt: string;
  updatedAt: string;
  recipes: Recipe[];
  processingJobs: ProcessingJob[];
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    uploaded: { label: "Uploade", className: "badge-pending", icon: <FileText className="h-3 w-3" /> },
    processing: { label: "En cours", className: "badge-processing", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    completed: { label: "Termine", className: "badge-completed", icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { label: "Echoue", className: "badge-failed", icon: <XCircle className="h-3 w-3" /> },
    pending: { label: "En attente", className: "badge-pending", icon: <Clock className="h-3 w-3" /> },
    approved: { label: "Approuvee", className: "badge-approved", icon: <CheckCircle2 className="h-3 w-3" /> },
    rejected: { label: "Rejetee", className: "badge-rejected", icon: <XCircle className="h-3 w-3" /> },
  };

  const variant = variants[status] || { label: status, className: "", icon: null };

  return (
    <Badge variant="outline" className={`${variant.className} gap-1`}>
      {variant.icon}
      {variant.label}
    </Badge>
  );
}

export default function CookbookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: cookbook, isLoading, refetch } = useQuery({
    queryKey: ["cookbook", id],
    queryFn: () => api.get<CookbookDetail>(`/api/cookbooks/${id}`),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "processing" ? 2000 : false;
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: () => api.post("/api/processing/start", { cookbookId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cookbook", id] });
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (!cookbook) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-gray-500 mb-4" />
          <h2 className="text-lg font-medium text-white">Livre non trouve</h2>
          <Button asChild className="mt-4">
            <Link to="/cookbooks">Retour aux livres</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const latestJob = cookbook.processingJobs?.[0];
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/cookbooks">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-white">{cookbook.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={cookbook.status} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cookbook.status !== "processing" && (
              <Button
                variant="outline"
                onClick={() => reprocessMutation.mutate()}
                disabled={reprocessMutation.isPending}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${reprocessMutation.isPending ? "animate-spin" : ""}`} />
                Retraiter
              </Button>
            )}
          </div>
        </div>

        {/* Processing Progress */}
        {cookbook.status === "processing" && (
          <div className="glass-card-static p-6 rounded-2xl border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="icon-container p-2 rounded-xl">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
                <div>
                  <p className="font-medium text-white">Traitement en cours</p>
                  <p className="text-sm text-gray-400">
                    Page {cookbook.processedPages} sur {cookbook.totalPages}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{cookbook.totalRecipesFound}</p>
                <p className="text-sm text-gray-400">recettes trouvees</p>
              </div>
            </div>
            <Progress value={processingProgress} className="h-2" />
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="icon-container p-2 rounded-xl">
                <ChefHat className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{recipeStats.total}</p>
                <p className="text-sm text-gray-400">Recettes</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="icon-container p-2 rounded-xl">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{recipeStats.pending}</p>
                <p className="text-sm text-gray-400">En attente</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="icon-container p-2 rounded-xl">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{recipeStats.approved}</p>
                <p className="text-sm text-gray-400">Approuvees</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="icon-container p-2 rounded-xl">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{recipeStats.rejected}</p>
                <p className="text-sm text-gray-400">Rejetees</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="recipes">
          <TabsList>
            <TabsTrigger value="recipes">Recettes</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="recipes" className="mt-4">
            {cookbook.recipes && cookbook.recipes.length > 0 ? (
              <div className="grid gap-3">
                {cookbook.recipes.map((recipe) => (
                  <Link key={recipe.id} to={`/recipes/${recipe.id}`}>
                    <div className="glass-card p-4 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="icon-container p-2 rounded-xl">
                            <ChefHat className="h-5 w-5 text-gray-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{recipe.title}</p>
                            <p className="text-sm text-gray-400">
                              {recipe.category || "Non categorise"} - Page {recipe.sourcePage || "?"}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={recipe.status} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass-card-static p-8 rounded-2xl">
                <div className="py-12 text-center">
                  <ChefHat className="h-10 w-10 mx-auto text-gray-500 mb-4" />
                  <p className="text-gray-400">Aucune recette extraite</p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="details" className="mt-4">
            <div className="glass-card-static p-8 rounded-2xl">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-500">Nom du fichier</p>
                    <p className="font-medium text-white">{cookbook.filePath?.split("/").pop() || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Taille</p>
                    <p className="font-medium text-white">{formatFileSize(cookbook.fileSize)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Nombre de pages</p>
                    <p className="font-medium text-white">{cookbook.totalPages || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date d'upload</p>
                    <p className="font-medium text-white">{formatDate(cookbook.createdAt)}</p>
                  </div>
                </div>
                <hr className="border-white/10" />
                <div>
                  <p className="text-sm text-gray-500 mb-2">Options de traitement</p>
                  <div className="flex flex-wrap gap-2">
                    {cookbook.generateDescriptions && (
                      <Badge variant="secondary">Descriptions generees</Badge>
                    )}
                    {cookbook.reformulateForCopyright && (
                      <Badge variant="secondary">Reformulation copyright</Badge>
                    )}
                    {cookbook.convertToGrams && (
                      <Badge variant="secondary">Conversion en grammes</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <div className="glass-card-static p-8 rounded-2xl">
              <h3 className="text-base font-semibold text-white mb-4">Journal de traitement</h3>
              {latestJob ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1 font-mono text-sm">
                    {(latestJob.processingLog as string[])?.map((log, index) => (
                      <p key={index} className="text-gray-400">
                        {log}
                      </p>
                    ))}
                    {(latestJob.errorLog as string[])?.map((error, index) => (
                      <p key={`error-${index}`} className="text-destructive">
                        Erreur: {error}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-gray-400 text-center py-8">
                  Aucun log disponible
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
