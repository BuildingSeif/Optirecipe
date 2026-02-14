import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassButton } from "@/components/ui/glass-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ChefHat, Search, Loader2, CheckCircle2, XCircle, Trash2, SlidersHorizontal, X } from "lucide-react";
import type { Recipe, Cookbook } from "../../../backend/src/types";

interface RecipesResponse {
  recipes: Recipe[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const statuses = [
  { value: "all", label: "Tous" },
  { value: "pending", label: "En attente" },
  { value: "approved", label: "Approuvees" },
  { value: "rejected", label: "Rejetees" },
];

const mealTypes = [
  { value: "petit_dejeuner", label: "Petit-dejeuner" },
  { value: "dejeuner", label: "Dejeuner" },
  { value: "diner", label: "Diner" },
  { value: "collation", label: "Collation" },
] as const;

const cookTimeOptions = [
  { value: "15", label: "< 15 min" },
  { value: "30", label: "< 30 min" },
  { value: "60", label: "< 1 heure" },
] as const;

const dietaryFilters = [
  { value: "is_vegan", label: "Vegan" },
  { value: "is_vegetarian", label: "Vegetarien" },
  { value: "is_gluten_free", label: "Sans gluten" },
  { value: "is_lactose_free", label: "Sans produits laitiers" },
  { value: "is_halal", label: "Halal" },
  { value: "is_low_carb", label: "Faible en glucides" },
  { value: "is_low_fat", label: "Faible en matieres grasses" },
  { value: "is_high_protein", label: "Riche en proteines" },
  { value: "is_mediterranean", label: "Mediterraneen" },
  { value: "is_whole30", label: "Whole30" },
  { value: "is_low_sodium", label: "Faible en sodium" },
] as const;

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    pending: { label: "En attente", className: "badge-pending" },
    approved: { label: "Approuvee", className: "badge-approved" },
    rejected: { label: "Rejetee", className: "badge-rejected" },
  };
  const variant = variants[status] || { label: status, className: "" };
  return <Badge variant="outline" className={`${variant.className} font-semibold`}>{variant.label}</Badge>;
}

function TogglePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
        active
          ? "bg-primary/20 border-primary/40 text-primary"
          : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white/80"
      )}
    >
      {children}
    </button>
  );
}

export default function RecipesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const page = parseInt(searchParams.get("page") || "1");
  const cookbookId = searchParams.get("cookbookId") || "all";
  const category = searchParams.get("category") || "all";
  const type = searchParams.get("type") || "all";
  const mealType = searchParams.get("mealType") || "";
  const cookTimeMax = searchParams.get("cookTimeMax") || "";
  const dietaryParam = searchParams.get("dietaryFilters") || "";

  const selectedMealTypes = mealType ? mealType.split(",") : [];
  const selectedDietary = dietaryParam ? dietaryParam.split(",") : [];

  const toggleMultiFilter = (key: string, value: string, currentValues: string[]) => {
    const newParams = new URLSearchParams(searchParams);
    const updated = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    if (updated.length > 0) {
      newParams.set(key, updated.join(","));
    } else {
      newParams.delete(key);
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const toggleCookTime = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (cookTimeMax === value) {
      newParams.delete("cookTimeMax");
    } else {
      newParams.set("cookTimeMax", value);
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const hasAnyFilter =
    search !== "" ||
    status !== "all" ||
    category !== "all" ||
    type !== "all" ||
    cookbookId !== "all" ||
    mealType !== "" ||
    cookTimeMax !== "" ||
    dietaryParam !== "";

  const hasAdvancedFilter = mealType !== "" || cookTimeMax !== "" || dietaryParam !== "";

  const { data: cookbooks } = useQuery({
    queryKey: ["cookbooks"],
    queryFn: () => api.get<Cookbook[]>("/api/cookbooks"),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ id: string; name: string; order: number }[]>("/api/categories"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["recipes", { search, status, page, cookbookId, category, type, mealType, cookTimeMax, dietaryFilters: dietaryParam }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);
      if (cookbookId && cookbookId !== "all") params.set("cookbookId", cookbookId);
      if (category && category !== "all") params.set("category", category);
      if (type && type !== "all") params.set("type", type);
      if (mealType) params.set("mealType", mealType);
      if (cookTimeMax) params.set("cookTimeMax", cookTimeMax);
      if (dietaryParam) params.set("dietaryFilters", dietaryParam);
      params.set("page", page.toString());
      params.set("limit", "20");
      return api.get<RecipesResponse>(`/api/recipes?${params.toString()}`);
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      return api.patch<{ updated: number }>("/api/recipes/bulk/status", { ids, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setSelectedIds(new Set());
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api.delete(`/api/recipes/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setSelectedIds(new Set());
    },
  });

  const recipes = data?.recipes ?? [];

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

  return (
    <DashboardLayout
      title="Recettes"
      subtitle="Gerez et organisez toutes vos recettes"
      breadcrumbs={[
        { label: "Accueil", href: "/dashboard" },
        { label: "Recettes" },
      ]}
    >
      <div className="space-y-6">
        {/* Section heading */}
        <h2 className="text-white font-heading text-lg font-semibold">Filtres</h2>

        {/* Filters */}
        <div className="ct-card p-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="ct-input flex items-center gap-3 rounded-lg px-4 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-white/40" />
            <input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/50 py-3 text-sm font-medium"
            />
          </div>

          {/* Status */}
          <Select value={status} onValueChange={(v) => updateFilter("status", v)}>
            <SelectTrigger className="w-[160px] ct-input border-none text-sm font-semibold text-white">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category */}
          <Select value={category} onValueChange={(v) => updateFilter("category", v)}>
            <SelectTrigger className="w-[160px] ct-input border-none text-sm font-semibold text-white">
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes categories</SelectItem>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Type */}
          <Select value={type} onValueChange={(v) => updateFilter("type", v)}>
            <SelectTrigger className="w-[160px] ct-input border-none text-sm font-semibold text-white">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              <SelectItem value="prive">Prive</SelectItem>
              <SelectItem value="collectivite">Collectivite</SelectItem>
              <SelectItem value="both">Les deux</SelectItem>
            </SelectContent>
          </Select>

          {/* Cookbook filter */}
          {cookbooks && cookbooks.length > 0 ? (
            <Select value={cookbookId} onValueChange={(v) => updateFilter("cookbookId", v)}>
              <SelectTrigger className="w-[180px] ct-input border-none text-sm font-semibold text-white">
                <SelectValue placeholder="Livre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les livres</SelectItem>
                {cookbooks.map((cb) => (
                  <SelectItem key={cb.id} value={cb.id}>{cb.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {/* Advanced filters toggle */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
              showAdvancedFilters || hasAdvancedFilter
                ? "bg-primary/20 text-primary"
                : "bg-white/[0.06] text-white/60 hover:text-white/80"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtres avances
            {hasAdvancedFilter ? (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary/30 text-[10px] text-primary font-bold">
                {(selectedMealTypes.length > 0 ? 1 : 0) + (cookTimeMax ? 1 : 0) + (selectedDietary.length > 0 ? 1 : 0)}
              </span>
            ) : null}
          </button>

          {/* Tout effacer */}
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white/50 hover:text-white/80 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Tout effacer
            </button>
          ) : null}
        </div>

        {/* Advanced filters panel */}
        {showAdvancedFilters ? (
          <div className="ct-card p-4 space-y-5">
            {/* Section 1: Type de repas */}
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                Type de repas
              </p>
              <div className="flex flex-wrap gap-2">
                {mealTypes.map((mt) => (
                  <TogglePill
                    key={mt.value}
                    active={selectedMealTypes.includes(mt.value)}
                    onClick={() => toggleMultiFilter("mealType", mt.value, selectedMealTypes)}
                  >
                    {mt.label}
                  </TogglePill>
                ))}
              </div>
            </div>

            {/* Section 2: Temps de cuisson */}
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                Temps de cuisson
              </p>
              <div className="flex flex-wrap gap-2">
                {cookTimeOptions.map((ct) => (
                  <TogglePill
                    key={ct.value}
                    active={cookTimeMax === ct.value}
                    onClick={() => toggleCookTime(ct.value)}
                  >
                    {ct.label}
                  </TogglePill>
                ))}
              </div>
            </div>

            {/* Section 3: Regime alimentaire */}
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                Regime alimentaire
              </p>
              <div className="flex flex-wrap gap-2">
                {dietaryFilters.map((df) => (
                  <TogglePill
                    key={df.value}
                    active={selectedDietary.includes(df.value)}
                    onClick={() => toggleMultiFilter("dietaryFilters", df.value, selectedDietary)}
                  >
                    {df.label}
                  </TogglePill>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Results heading */}
        <h2 className="text-white font-heading text-lg font-semibold">Resultats</h2>

        {/* Results */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : recipes.length > 0 ? (
          <>
            <div className="flex items-center gap-3 text-sm text-white/70 font-medium">
              <Checkbox
                checked={recipes.length > 0 && recipes.every((r) => selectedIds.has(r.id))}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedIds(new Set(recipes.map((r) => r.id)));
                  } else {
                    setSelectedIds(new Set());
                  }
                }}
              />
              <span>{data?.pagination.total ?? 0} recettes</span>
            </div>

            <div className="ct-card rounded-xl divide-y divide-white/[0.06]">
              {recipes.map((recipe) => (
                <div key={recipe.id} className="flex items-center gap-4 p-4 hover:bg-white/[0.04] transition-colors">
                  <Checkbox
                    checked={selectedIds.has(recipe.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedIds);
                      if (checked) next.add(recipe.id);
                      else next.delete(recipe.id);
                      setSelectedIds(next);
                    }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    className="flex-shrink-0"
                  />
                  <Link to={`/recipes/${recipe.id}`} className="flex-1 flex items-center gap-4">
                    {/* Thumbnail */}
                    {recipe.imageUrl ? (
                      <img src={recipe.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <ChefHat className="h-5 w-5 text-white/40" />
                      </div>
                    )}

                    {/* Title & meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{recipe.title}</p>
                      {recipe.originalTitle && recipe.originalTitle !== recipe.title ? (
                        <p className="text-xs text-white/40 truncate">{recipe.originalTitle}</p>
                      ) : null}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-white/50">{recipe.category || "-"}</span>
                        {recipe.difficulty ? (
                          <span className="text-xs text-white/40">{recipe.difficulty}</span>
                        ) : null}
                        {recipe.type && recipe.type !== "both" ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${recipe.type === "prive" ? "bg-blue-500/20 text-blue-400" : "bg-amber-500/20 text-amber-400"}`}>
                            {recipe.type === "prive" ? "Prive" : "Collectivite"}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Status dot + dietary indicators */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {recipe.is_vegetarian ? <span className="status-dot status-dot-approved" title="Vegetarien" /> : null}
                        {recipe.is_vegan ? <span className="status-dot status-dot-approved" title="Vegan" /> : null}
                        {recipe.is_gluten_free ? <span className="status-dot status-dot-pending" title="Sans gluten" /> : null}
                        {recipe.is_halal ? <span className="status-dot status-dot-approved" title="Halal" /> : null}
                      </div>
                      <span className={`status-dot status-dot-${recipe.status}`} />
                    </div>

                    <StatusBadge status={recipe.status} />
                  </Link>
                </div>
              ))}
            </div>

            {data?.pagination && data.pagination.totalPages > 1 ? (
              <div className="flex items-center justify-center gap-4 text-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white font-semibold"
                  disabled={page <= 1}
                  onClick={() => updateFilter("page", (page - 1).toString())}
                >
                  Precedent
                </Button>
                <span className="text-white/70 font-medium">Page {page} / {data.pagination.totalPages}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white font-semibold"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => updateFilter("page", (page + 1).toString())}
                >
                  Suivant
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="ct-card rounded-xl text-center py-12">
            <ChefHat className="h-10 w-10 mx-auto text-white/30 mb-4" />
            <p className="text-white/60 font-medium">Aucune recette</p>
          </div>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 ct-card px-6 py-3 rounded-full shadow-2xl">
          <span className="text-sm font-medium text-white/80">
            {selectedIds.size} recette{selectedIds.size > 1 ? "s" : ""} selectionnee{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="w-px h-6 bg-white/20" />
          <GlassButton
            variant="success"
            size="sm"
            onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: "approved" })}
            disabled={bulkStatusMutation.isPending}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Approuver tout
          </GlassButton>
          <GlassButton
            variant="destructive"
            size="sm"
            onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: "rejected" })}
            disabled={bulkStatusMutation.isPending}
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" />
            Rejeter tout
          </GlassButton>
          <GlassButton
            variant="destructive"
            size="sm"
            onClick={() => {
              if (window.confirm(`Supprimer ${selectedIds.size} recette(s) ? Cette action est irreversible.`)) {
                bulkDeleteMutation.mutate(Array.from(selectedIds));
              }
            }}
            disabled={bulkDeleteMutation.isPending}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Supprimer
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Deselectionner
          </GlassButton>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
