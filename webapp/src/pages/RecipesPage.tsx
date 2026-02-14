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
import { ChefHat, Search, Loader2, CheckCircle2, XCircle } from "lucide-react";
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

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    pending: { label: "En attente", className: "badge-pending" },
    approved: { label: "Approuvee", className: "badge-approved" },
    rejected: { label: "Rejetee", className: "badge-rejected" },
  };
  const variant = variants[status] || { label: status, className: "" };
  return <Badge variant="outline" className={`${variant.className} font-semibold`}>{variant.label}</Badge>;
}

export default function RecipesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([]);

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const page = parseInt(searchParams.get("page") || "1");
  const cookbookId = searchParams.get("cookbookId") || "all";
  const category = searchParams.get("category") || "all";
  const type = searchParams.get("type") || "all";

  const { data: cookbooks } = useQuery({
    queryKey: ["cookbooks"],
    queryFn: () => api.get<Cookbook[]>("/api/cookbooks"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["recipes", { search, status, page, cookbookId, category, type }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);
      if (cookbookId && cookbookId !== "all") params.set("cookbookId", cookbookId);
      if (category && category !== "all") params.set("category", category);
      if (type && type !== "all") params.set("type", type);
      params.set("page", page.toString());
      params.set("limit", "20");
      return api.get<RecipesResponse>(`/api/recipes?${params.toString()}`);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (params: { status: string }) =>
      api.patch("/api/recipes/bulk/status", { ids: selectedRecipes, status: params.status }),
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

  return (
    <DashboardLayout title="Recettes">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="glass-card-static flex items-center gap-3 rounded-xl px-4 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-primary" />
            <input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/50 py-3 text-sm font-medium"
            />
          </div>

          {/* Status */}
          <Select value={status} onValueChange={(v) => updateFilter("status", v)}>
            <SelectTrigger className="w-[160px] glass-card-static border-none text-sm font-semibold text-white">
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
            <SelectTrigger className="w-[160px] glass-card-static border-none text-sm font-semibold text-white">
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes categories</SelectItem>
              <SelectItem value="entree">Entree</SelectItem>
              <SelectItem value="plat">Plat</SelectItem>
              <SelectItem value="dessert">Dessert</SelectItem>
              <SelectItem value="petit-dejeuner">Petit-dejeuner</SelectItem>
              <SelectItem value="accompagnement">Accompagnement</SelectItem>
              <SelectItem value="sauce">Sauce</SelectItem>
              <SelectItem value="boisson">Boisson</SelectItem>
            </SelectContent>
          </Select>

          {/* Type */}
          <Select value={type} onValueChange={(v) => updateFilter("type", v)}>
            <SelectTrigger className="w-[160px] glass-card-static border-none text-sm font-semibold text-white">
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
              <SelectTrigger className="w-[180px] glass-card-static border-none text-sm font-semibold text-white">
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
        </div>

        {/* Bulk Actions */}
        {selectedRecipes.length > 0 ? (
          <div className="flex items-center justify-between p-4 bg-primary/20 rounded-xl border border-primary/30">
            <span className="text-sm text-white font-semibold">{selectedRecipes.length} selectionnee(s)</span>
            <div className="flex gap-2">
              <Button size="sm" className="font-semibold" onClick={() => bulkUpdateMutation.mutate({ status: "approved" })}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Approuver
              </Button>
              <Button size="sm" variant="destructive" className="font-semibold" onClick={() => bulkUpdateMutation.mutate({ status: "rejected" })}>
                <XCircle className="mr-1 h-4 w-4" /> Rejeter
              </Button>
            </div>
          </div>
        ) : null}

        {/* Results */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : data?.recipes && data.recipes.length > 0 ? (
          <>
            <div className="text-sm text-white/70 font-medium">{data.pagination.total} recettes</div>

            <div className="glass-card-static rounded-xl divide-y divide-white/10">
              {data.recipes.map((recipe) => (
                <div key={recipe.id} className="flex items-center gap-4 p-4 hover:bg-white/10 transition-colors">
                  <Checkbox
                    checked={selectedRecipes.includes(recipe.id)}
                    onCheckedChange={() => toggleRecipeSelection(recipe.id)}
                  />
                  <Link to={`/recipes/${recipe.id}`} className="flex-1 flex items-center gap-4">
                    {/* Thumbnail */}
                    {recipe.imageUrl ? (
                      <img src={recipe.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <ChefHat className="h-5 w-5 text-primary" />
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

                    {/* Dietary icons */}
                    <div className="flex items-center gap-1">
                      {recipe.is_vegetarian ? <span className="h-2 w-2 rounded-full bg-green-500" title="Vegetarien" /> : null}
                      {recipe.is_vegan ? <span className="h-2 w-2 rounded-full bg-emerald-400" title="Vegan" /> : null}
                      {recipe.is_gluten_free ? <span className="h-2 w-2 rounded-full bg-amber-400" title="Sans gluten" /> : null}
                      {recipe.is_halal ? <span className="h-2 w-2 rounded-full bg-teal-400" title="Halal" /> : null}
                    </div>

                    <StatusBadge status={recipe.status} />
                  </Link>
                </div>
              ))}
            </div>

            {data.pagination.totalPages > 1 ? (
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
          <div className="glass-card-static rounded-xl text-center py-12">
            <ChefHat className="h-10 w-10 mx-auto text-primary mb-4" />
            <p className="text-white/60 font-medium">Aucune recette</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
