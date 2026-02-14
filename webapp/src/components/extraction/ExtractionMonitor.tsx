import { useState, useRef, useEffect, useMemo } from "react";
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  StopCircle,
  ChefHat,
  Terminal,
  ChevronDown,
  BookOpen,
  Upload,
  AlertCircle,
} from "lucide-react";
import type { Recipe, ProcessingJob } from "../../../../backend/src/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  type: string;
  recipes: Recipe[];
  processingJobs: ProcessingJob[];
}

export interface ExtractionMonitorProps {
  cookbookIds: string[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabStatusDot({ status }: { status: string }) {
  if (status === "processing") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex rounded-full h-2 w-2 bg-emerald-400" />
    );
  }
  if (status === "failed" || status === "cancelled") {
    return <span className="inline-flex rounded-full h-2 w-2 bg-red-400" />;
  }
  if (status === "paused") {
    return <span className="inline-flex rounded-full h-2 w-2 bg-amber-400" />;
  }
  return <span className="inline-flex rounded-full h-2 w-2 bg-white/30" />;
}

function RecipeCard({ recipe, isNew }: { recipe: Recipe; isNew: boolean }) {
  const categoryColors: Record<string, string> = {
    entree: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    plat: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    dessert: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    "petit-dejeuner":
      "bg-amber-500/20 text-amber-300 border-amber-500/30",
    accompagnement:
      "bg-violet-500/20 text-violet-300 border-violet-500/30",
    sauce: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    boisson: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  };

  const categoryClass =
    categoryColors[recipe.category?.toLowerCase() ?? ""] ??
    "bg-white/10 text-white/70 border-white/20";

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-all ${
        isNew ? "animate-slide-up" : ""
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <ChefHat className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-white truncate">
          {recipe.title}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {recipe.category ? (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${categoryClass}`}
            >
              {recipe.category}
            </span>
          ) : null}
          {recipe.sourcePage ? (
            <span className="text-[10px] text-white/40">
              p. {recipe.sourcePage}
            </span>
          ) : null}
        </div>
        {recipe.description ? (
          <p className="text-xs text-white/50 line-clamp-2">
            {recipe.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ProcessingLogView({ logs }: { logs: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      ref={scrollRef}
      className="bg-[#0a0e17] rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5"
    >
      {logs.map((log, i) => (
        <div key={i} className="text-white/50">
          <span className="text-primary/60 select-none mr-2">
            {String(i + 1).padStart(3, " ")}
          </span>
          {log}
        </div>
      ))}
      {logs.length === 0 ? (
        <div className="text-white/30 text-center py-4">
          Aucun log disponible
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Tab Content
// ---------------------------------------------------------------------------

function CookbookMonitor({ cookbookId }: { cookbookId: string }) {
  const queryClient = useQueryClient();
  const [seenRecipeIds, setSeenRecipeIds] = useState<Set<string>>(
    new Set()
  );
  const [showLogs, setShowLogs] = useState(false);

  const { data: cookbook } = useQuery({
    queryKey: ["cookbook", cookbookId],
    queryFn: () =>
      api.get<CookbookDetail>(`/api/cookbooks/${cookbookId}`),
    refetchInterval: (query) => {
      const data = query.state.data;
      const status = data?.status;
      return status === "processing" || status === "paused" ? 2000 : false;
    },
  });

  const latestJob = cookbook?.processingJobs?.[0];

  const pauseMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/processing/${latestJob?.id}/pause`, {}),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["cookbook", cookbookId],
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/processing/${latestJob?.id}/cancel`, {}),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["cookbook", cookbookId],
      }),
  });

  const resumeMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/processing/${latestJob?.id}/resume`, {}),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["cookbook", cookbookId],
      }),
  });

  // Track newly appearing recipes
  const newRecipeIds = useMemo(() => {
    if (!cookbook?.recipes) return new Set<string>();
    const currentIds = new Set(cookbook.recipes.map((r) => r.id));
    const fresh = new Set<string>();
    currentIds.forEach((id) => {
      if (!seenRecipeIds.has(id)) fresh.add(id);
    });
    return fresh;
  }, [cookbook?.recipes, seenRecipeIds]);

  // Update seen set after render
  useEffect(() => {
    if (!cookbook?.recipes) return;
    const currentIds = new Set(cookbook.recipes.map((r) => r.id));
    if (currentIds.size !== seenRecipeIds.size) {
      setSeenRecipeIds(currentIds);
    }
  }, [cookbook?.recipes, seenRecipeIds.size]);

  const parsedLogs: string[] = useMemo(() => {
    if (!latestJob?.processingLog) return [];
    if (Array.isArray(latestJob.processingLog))
      return latestJob.processingLog;
    try {
      const parsed = JSON.parse(
        latestJob.processingLog as unknown as string
      );
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [latestJob?.processingLog]);

  if (!cookbook) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalPages = cookbook.totalPages || 0;
  const processedPages = cookbook.processedPages || 0;
  const progressPercent =
    totalPages > 0 ? (processedPages / totalPages) * 100 : 0;
  const isProcessing = cookbook.status === "processing";
  const isPaused = cookbook.status === "paused";
  const isCompleted = cookbook.status === "completed";
  const isFailed =
    cookbook.status === "failed" || cookbook.status === "cancelled";

  const recipes = cookbook.recipes ?? [];

  const handlePause = () => {
    if (latestJob) pauseMutation.mutate();
  };

  const handleCancel = () => {
    if (
      latestJob &&
      window.confirm(
        "Etes-vous sur de vouloir arreter l'extraction ?"
      )
    ) {
      cancelMutation.mutate();
    }
  };

  const handleResume = () => {
    if (latestJob) resumeMutation.mutate();
  };

  return (
    <div className="space-y-5">
      {/* Progress Section */}
      <div className="glass-card-static p-6 rounded-xl space-y-4">
        {/* Status header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isProcessing ? (
              <div className="relative">
                <div className="w-10 h-10 rounded-full border-2 border-primary/30 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                </span>
              </div>
            ) : isPaused ? (
              <div className="w-10 h-10 rounded-full border-2 border-amber-400/30 flex items-center justify-center">
                <Pause className="h-5 w-5 text-amber-400" />
              </div>
            ) : isCompleted ? (
              <div className="w-10 h-10 rounded-full border-2 border-emerald-400/30 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
            ) : isFailed ? (
              <div className="w-10 h-10 rounded-full border-2 border-red-400/30 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
            ) : null}
            <div>
              <p className="text-white font-semibold text-sm">
                {isProcessing
                  ? "Extraction en cours..."
                  : isPaused
                    ? "Extraction en pause"
                    : isCompleted
                      ? "Extraction terminee"
                      : isFailed
                        ? "Extraction echouee"
                        : "En attente"}
              </p>
              <p className="text-white/50 text-xs">
                {totalPages > 0
                  ? `Page ${processedPages} / ${totalPages}`
                  : "Analyse du document..."}
              </p>
            </div>
          </div>

          {/* Recipe counter */}
          <div className="text-right">
            <p
              key={cookbook.totalRecipesFound}
              className="text-2xl font-bold text-white animate-fade-in"
            >
              {cookbook.totalRecipesFound}
            </p>
            <p className="text-xs text-white/50">recettes trouvees</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between text-[10px] text-white/40">
            <span>{Math.round(progressPercent)}%</span>
            <span>
              {processedPages} / {totalPages} pages
            </span>
          </div>
        </div>

        {/* Control Buttons */}
        {isProcessing ? (
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              disabled={pauseMutation.isPending}
              className="flex-1 border-white/10 hover:bg-white/5"
            >
              <Pause className="mr-2 h-3 w-3" />
              Mettre en pause
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="flex-1 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50 hover:bg-destructive/5"
            >
              <StopCircle className="mr-2 h-3 w-3" />
              Arreter
            </Button>
          </div>
        ) : isPaused ? (
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResume}
              disabled={resumeMutation.isPending}
              className="flex-1 border-white/10 hover:bg-white/5"
            >
              <Play className="mr-2 h-3 w-3" />
              Reprendre l'extraction
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="flex-1 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50 hover:bg-destructive/5"
            >
              <StopCircle className="mr-2 h-3 w-3" />
              Arreter
            </Button>
          </div>
        ) : isCompleted ? (
          <Button
            asChild
            className="w-full gradient-primary font-semibold shadow-lg shadow-primary/30"
            size="sm"
          >
            <Link to={`/cookbooks/${cookbookId}`}>
              <BookOpen className="mr-2 h-4 w-4" />
              Voir les recettes
            </Link>
          </Button>
        ) : isFailed && cookbook.errorMessage ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-xs text-destructive/80">
              {cookbook.errorMessage}
            </p>
          </div>
        ) : null}
      </div>

      {/* Live Recipe Feed */}
      {recipes.length > 0 ? (
        <div className="glass-card-static p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/80">
              Recettes extraites
            </h3>
            <span className="text-xs text-white/40">
              {recipes.length} recette{recipes.length > 1 ? "s" : ""}
            </span>
          </div>

          <ScrollArea className="max-h-[360px]">
            <div className="space-y-2 pr-2">
              {[...recipes].reverse().map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isNew={newRecipeIds.has(recipe.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : null}

      {/* Processing Log */}
      <Collapsible open={showLogs} onOpenChange={setShowLogs}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors w-full justify-center py-2">
            <Terminal className="h-3 w-3" />
            <span>Voir les logs</span>
            <ChevronDown
              className={`h-3 w-3 transition-transform ${
                showLogs ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ProcessingLogView logs={parsedLogs} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ExtractionMonitor({
  cookbookIds,
  onClose,
}: ExtractionMonitorProps) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // Fetch all cookbooks for tab bar status using useQueries (stable hook count)
  const cookbookQueries = useQueries({
    queries: cookbookIds.map((cbId) => ({
      queryKey: ["cookbook", cbId] as const,
      queryFn: () =>
        api.get<CookbookDetail>(`/api/cookbooks/${cbId}`),
      refetchInterval: (query: { state: { data: CookbookDetail | undefined } }) => {
        const data = query.state.data;
        const status = data?.status;
        return status === "processing" || status === "paused"
          ? 2000
          : false;
      },
    })),
  });

  const activeCookbookId =
    cookbookIds[activeTabIndex] ?? cookbookIds[0];

  // Check if all cookbooks are done
  const allDone = cookbookQueries.every((q) => {
    const s = q.data?.status;
    return s === "completed" || s === "failed" || s === "cancelled";
  });

  const totalRecipes = cookbookQueries.reduce(
    (sum, q) => sum + (q.data?.totalRecipesFound ?? 0),
    0
  );

  const completedCount = cookbookQueries.filter(
    (q) => q.data?.status === "completed"
  ).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent">
          Extraction en cours
        </h2>
        <p className="text-sm text-white/50">
          {allDone
            ? "Toutes les extractions sont terminees"
            : `${cookbookIds.length} livre${
                cookbookIds.length > 1 ? "s" : ""
              } en cours de traitement`}
        </p>
      </div>

      {/* Tab Bar */}
      {cookbookIds.length > 1 ? (
        <div className="glass-card-static rounded-xl overflow-hidden">
          <div className="flex overflow-x-auto">
            {cookbookIds.map((cbId, index) => {
              const q = cookbookQueries[index];
              const name =
                q?.data?.name ?? `Livre ${index + 1}`;
              const status = q?.data?.status ?? "processing";
              const isActive = index === activeTabIndex;

              return (
                <button
                  key={cbId}
                  onClick={() => setActiveTabIndex(index)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors flex-shrink-0 ${
                    isActive
                      ? "text-white"
                      : "text-white/50 hover:text-white/70"
                  }`}
                >
                  <TabStatusDot status={status} />
                  <span className="truncate max-w-[140px]">
                    {name}
                  </span>
                  {isActive ? (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00D4FF] to-[#0066FF] transition-all" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Active Tab Content */}
      {allDone ? (
        <div className="glass-card-static p-8 rounded-xl text-center space-y-6 animate-slide-up">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">
              {completedCount} livre
              {completedCount > 1 ? "s" : ""} traite
              {completedCount > 1 ? "s" : ""} -{" "}
              {totalRecipes} recettes extraites
            </h3>
            <p className="text-sm text-white/50">
              Vous pouvez maintenant consulter et approuver vos
              recettes.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              asChild
              className="gradient-primary font-semibold shadow-lg shadow-primary/30"
            >
              <Link to="/recipes">
                <ChefHat className="mr-2 h-4 w-4" />
                Voir les recettes
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="border-white/10 hover:bg-white/5"
            >
              <Upload className="mr-2 h-4 w-4" />
              Uploader d'autres livres
            </Button>
          </div>
        </div>
      ) : (
        <CookbookMonitor
          key={activeCookbookId}
          cookbookId={activeCookbookId}
        />
      )}
    </div>
  );
}
