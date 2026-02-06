import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une recette..."
                  value={search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={status} onValueChange={(v) => updateFilter("status", v)}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
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
                <SelectTrigger className="w-[180px]">
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
              <div className="flex items-center gap-1 border rounded-lg p-1">
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
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedRecipes.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between">
              <p className="font-medium">
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
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                <span className="text-sm text-muted-foreground">
                  {data.pagination.total} recette{data.pagination.total > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Grid/List View */}
            {viewMode === "grid" ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.recipes.map((recipe) => (
                  <Card key={recipe.id} className="card-hover overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedRecipes.includes(recipe.id)}
                            onCheckedChange={() => toggleRecipeSelection(recipe.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Link to={`/recipes/${recipe.id}`} className="flex-1 min-w-0">
                            <h3 className="font-semibold line-clamp-1">{recipe.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
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
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          {recipe.prepTimeMinutes && (
                            <span>Prépa: {recipe.prepTimeMinutes}min</span>
                          )}
                          {recipe.cookTimeMinutes && (
                            <span>Cuisson: {recipe.cookTimeMinutes}min</span>
                          )}
                          {recipe.servings && <span>{recipe.servings} pers.</span>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {data.recipes.map((recipe) => (
                  <Card key={recipe.id} className="card-hover">
                    <CardContent className="p-4 flex items-center gap-4">
                      <Checkbox
                        checked={selectedRecipes.includes(recipe.id)}
                        onCheckedChange={() => toggleRecipeSelection(recipe.id)}
                      />
                      <div className="rounded-lg bg-muted p-2">
                        <ChefHat className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Link to={`/recipes/${recipe.id}`} className="flex-1 min-w-0">
                        <h3 className="font-medium">{recipe.title}</h3>
                        <p className="text-sm text-muted-foreground">
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => updateFilter("page", (page - 1).toString())}
                >
                  Précédent
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} sur {data.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => updateFilter("page", (page + 1).toString())}
                >
                  Suivant
                </Button>
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ChefHat className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune recette trouvée</h3>
              <p className="text-muted-foreground text-center">
                {search || status !== "all" || category !== "all"
                  ? "Essayez de modifier vos filtres"
                  : "Commencez par uploader un livre de recettes"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
