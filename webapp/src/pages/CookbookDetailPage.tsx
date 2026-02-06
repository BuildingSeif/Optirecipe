import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    uploaded: { label: "Uploadé", className: "bg-muted", icon: <FileText className="h-3 w-3" /> },
    processing: { label: "En cours", className: "bg-primary/10 text-primary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    completed: { label: "Terminé", className: "bg-success/10 text-success", icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { label: "Échoué", className: "bg-destructive/10 text-destructive", icon: <XCircle className="h-3 w-3" /> },
    pending: { label: "En attente", className: "bg-warning/10 text-warning", icon: <Clock className="h-3 w-3" /> },
    approved: { label: "Approuvée", className: "bg-success/10 text-success", icon: <CheckCircle2 className="h-3 w-3" /> },
    rejected: { label: "Rejetée", className: "bg-destructive/10 text-destructive", icon: <XCircle className="h-3 w-3" /> },
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
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!cookbook) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium">Livre non trouvé</h2>
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
              <h1 className="text-2xl font-semibold">{cookbook.name}</h1>
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
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Traitement en cours</p>
                    <p className="text-sm text-muted-foreground">
                      Page {cookbook.processedPages} sur {cookbook.totalPages}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{cookbook.totalRecipesFound}</p>
                  <p className="text-sm text-muted-foreground">recettes trouvées</p>
                </div>
              </div>
              <Progress value={processingProgress} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <ChefHat className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{recipeStats.total}</p>
                  <p className="text-sm text-muted-foreground">Recettes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-warning/10 p-2">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{recipeStats.pending}</p>
                  <p className="text-sm text-muted-foreground">En attente</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-success/10 p-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{recipeStats.approved}</p>
                  <p className="text-sm text-muted-foreground">Approuvées</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-destructive/10 p-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{recipeStats.rejected}</p>
                  <p className="text-sm text-muted-foreground">Rejetées</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="recipes">
          <TabsList>
            <TabsTrigger value="recipes">Recettes</TabsTrigger>
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="recipes" className="mt-4">
            {cookbook.recipes && cookbook.recipes.length > 0 ? (
              <div className="grid gap-3">
                {cookbook.recipes.map((recipe) => (
                  <Link key={recipe.id} to={`/recipes/${recipe.id}`}>
                    <Card className="card-hover">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-muted p-2">
                            <ChefHat className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{recipe.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {recipe.category || "Non catégorisé"} • Page {recipe.sourcePage || "?"}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={recipe.status} />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <ChefHat className="h-10 w-10 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucune recette extraite</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="details" className="mt-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Nom du fichier</p>
                    <p className="font-medium">{cookbook.filePath?.split("/").pop() || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Taille</p>
                    <p className="font-medium">{formatFileSize(cookbook.fileSize)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre de pages</p>
                    <p className="font-medium">{cookbook.totalPages || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date d'upload</p>
                    <p className="font-medium">{formatDate(cookbook.createdAt)}</p>
                  </div>
                </div>
                <hr />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Options de traitement</p>
                  <div className="flex flex-wrap gap-2">
                    {cookbook.generateDescriptions && (
                      <Badge variant="secondary">Descriptions générées</Badge>
                    )}
                    {cookbook.reformulateForCopyright && (
                      <Badge variant="secondary">Reformulation copyright</Badge>
                    )}
                    {cookbook.convertToGrams && (
                      <Badge variant="secondary">Conversion en grammes</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Journal de traitement</CardTitle>
              </CardHeader>
              <CardContent>
                {latestJob ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-1 font-mono text-sm">
                      {(latestJob.processingLog as string[])?.map((log, index) => (
                        <p key={index} className="text-muted-foreground">
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
                  <p className="text-muted-foreground text-center py-8">
                    Aucun log disponible
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
