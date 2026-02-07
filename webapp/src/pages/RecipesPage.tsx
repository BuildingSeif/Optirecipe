import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  ChefHat,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  LayoutGrid,
  List,
} from "lucide-react";
import type { Recipe } from "../../../backend/src/types";

interface RecipesResponse {
  recipes: Recipe[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const categories = [
  { value: "all", label: "Toutes les catégories" },
  { value: "entrée", label: "Entrées" },
  { value: "plat", label: "Plats" },
  { value: "dessert", label: "Desserts" },
  { value: "petit-déjeuner", label: "Petit-déjeuner" },
  { value: "accompagnement", label: "Accompagnements" },
  { value: "sauce", label: "Sauces" },
  { value: "boisson", label: "Boissons" },
];

const statuses = [
  { value: "all", label: "Tous les statuts" },
  { value: "pending", label: "En attente" },
  { value: "approved", label: "Approuvées" },
  { value: "rejected", label: "Rejetées" },
  { value: "needs_review", label: "À revoir" },
];

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    pending: { label: "En attente", className: "bg-warning/10 text-warning border-warning/20", icon: <Clock className="h-3 w-3" /> },
    approved: { label: "Approuvée", className: "bg-success/10 text-success border-success/20", icon: <CheckCircle2 className="h-3 w-3" /> },
    rejected: { label: "Rejetée", className: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="h-3 w-3" /> },
    needs_review: { label: "À revoir", className: "bg-warning/10 text-warning border-warning/20", icon: <Clock className="h-3 w-3" /> },
  };

  const variant = variants[status] || { label: status, className: "", icon: null };

  return (
    <Badge variant="outline" className={`${variant.className} gap-1`}>
      {variant.icon}
      {variant.label}
    </Badge>
  );
}

export default function RecipesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const category = searchParams.get("category") || "all";
  const page = parseInt(searchParams.get("page") || "1");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["recipes", { search, status, category, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);
      if (category && category !== "all") params.set("category", category);
      params.set("page", page.toString());
      params.set("limit", "20");
      return api.get<RecipesResponse>(`/api/recipes?${params.toString()}`);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (params: { status: string }) =>
      api.patch("/api/recipes/bulk/status", {
        ids: selectedRecipes,
        status: params.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setSelectedRecipes([]);
    },
  });

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const toggleRecipeSelection = (id: string) => {
    setSelectedRecipes((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const toggleAllRecipes = () => {
    if (selectedRecipes.length === data?.recipes.length) {
      setSelectedRecipes([]);
    } else {
      setSelectedRecipes(data?.recipes.map((r) => r.id) || []);
    }
  };

  return (
    <DashboardLayout
      title="Recettes"
      description="Gérez et validez vos recettes extraites"
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="glass-card-static p-4 rounded-xl">
          <div className="flex flex-wrap items-center gap-4">
            <div className="glass-input flex items-center gap-3 rounded-xl px-4 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                placeholder="Rechercher une recette..."
                value={search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-gray-400 py-2"
              />
            </div>
            <Select value={status} onValueChange={(v) => updateFilter("status", v)}>
              <SelectTrigger className="w-[180px] glass-input border-none">
                <Filter className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={(v) => updateFilter("category", v)}>
              <SelectTrigger className="w-[180px] glass-input border-none">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 glass-card-static rounded-lg p-1">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedRecipes.length > 0 && (
          <div className="glass-card-static p-4 rounded-xl border border-primary/20">
            <div className="flex items-center justify-between">
              <p className="font-medium text-white">
                {selectedRecipes.length} recette{selectedRecipes.length > 1 ? "s" : ""} sélectionnée{selectedRecipes.length > 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => bulkUpdateMutation.mutate({ status: "approved" })}
                  disabled={bulkUpdateMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approuver
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => bulkUpdateMutation.mutate({ status: "rejected" })}
                  disabled={bulkUpdateMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Rejeter
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : data?.recipes && data.recipes.length > 0 ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedRecipes.length === data.recipes.length && data.recipes.length > 0}
                  onCheckedChange={toggleAllRecipes}
                />
                <span className="text-sm text-gray-400">
                  {data.pagination.total} recette{data.pagination.total > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Grid/List View */}
            {viewMode === "grid" ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.recipes.map((recipe) => (
                  <div key={recipe.id} className="glass-card p-0 rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedRecipes.includes(recipe.id)}
                          onCheckedChange={() => toggleRecipeSelection(recipe.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Link to={`/recipes/${recipe.id}`} className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white line-clamp-1">{recipe.title}</h3>
                          <p className="text-sm text-gray-400 line-clamp-2 mt-1">
                            {recipe.description || "Pas de description"}
                          </p>
                        </Link>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <Badge variant="secondary" className="text-xs">
                          {recipe.category || "Non catégorisé"}
                        </Badge>
                        <StatusBadge status={recipe.status} />
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        {recipe.prepTimeMinutes && (
                          <span>Prépa: {recipe.prepTimeMinutes}min</span>
                        )}
                        {recipe.cookTimeMinutes && (
                          <span>Cuisson: {recipe.cookTimeMinutes}min</span>
                        )}
                        {recipe.servings && <span>{recipe.servings} pers.</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {data.recipes.map((recipe) => (
                  <div key={recipe.id} className="glass-card rounded-xl">
                    <div className="p-4 flex items-center gap-4">
                      <Checkbox
                        checked={selectedRecipes.includes(recipe.id)}
                        onCheckedChange={() => toggleRecipeSelection(recipe.id)}
                      />
                      <div className="icon-container rounded-lg p-2">
                        <ChefHat className="h-5 w-5 text-gray-400" />
                      </div>
                      <Link to={`/recipes/${recipe.id}`} className="flex-1 min-w-0">
                        <h3 className="font-medium text-white">{recipe.title}</h3>
                        <p className="text-sm text-gray-400">
                          {recipe.category || "Non catégorisé"}
                        </p>
                      </Link>
                      <div className="flex items-center gap-2">
                        {recipe.cookbook && (
                          <Badge variant="outline" className="text-xs">
                            {recipe.cookbook.name}
                          </Badge>
                        )}
                        <StatusBadge status={recipe.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  className="glass-card-static px-4 py-2 rounded-xl text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                  disabled={page <= 1}
                  onClick={() => updateFilter("page", (page - 1).toString())}
                >
                  Précédent
                </button>
                <span className="text-sm text-gray-400">
                  Page {page} sur {data.pagination.totalPages}
                </span>
                <button
                  className="glass-card-static px-4 py-2 rounded-xl text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => updateFilter("page", (page + 1).toString())}
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="glass-card-static rounded-xl">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="icon-container rounded-full p-4 mb-4">
                <ChefHat className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Aucune recette trouvée</h3>
              <p className="text-gray-400 text-center">
                {search || status !== "all" || category !== "all"
                  ? "Essayez de modifier vos filtres"
                  : "Commencez par uploader un livre de recettes"}
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
