import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { GlassButton } from "@/components/ui/glass-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  ChefHat,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Save,
  Trash2,
  Loader2,
  AlertCircle,
  BookOpen,
  MapPin,
  ImagePlus,
  Sparkles,
  Plus,
} from "lucide-react";
import type { Recipe, Ingredient, Instruction, GenerateImageResponse } from "../../../backend/src/types";

interface RecipesResponse {
  recipes: Recipe[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface CategoryData {
  id: string;
  name: string;
  order: number;
  subCategories: { id: string; name: string; categoryId: string; order: number }[];
}

const seasons = [
  { value: "printemps", label: "Printemps" },
  { value: "ete", label: "Ete" },
  { value: "automne", label: "Automne" },
  { value: "hiver", label: "Hiver" },
  { value: "toutes", label: "Toutes saisons" },
];

const mealTypes = [
  { value: "petit_dejeuner", label: "Petit-dejeuner" },
  { value: "dejeuner", label: "Dejeuner" },
  { value: "diner", label: "Diner" },
  { value: "collation", label: "Collation" },
];

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    pending: { label: "En attente", className: "badge-pending" },
    approved: { label: "Approuvee", className: "badge-approved" },
    rejected: { label: "Rejetee", className: "badge-rejected" },
    needs_review: { label: "A revoir", className: "badge-pending" },
  };

  const variant = variants[status] || { label: status, className: "" };

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Recipe>>({});

  const { data: recipe, isLoading } = useQuery({
    queryKey: ["recipe", id],
    queryFn: () => api.get<Recipe>(`/api/recipes/${id}`),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryData[]>("/api/categories"),
  });

  const { data: countriesData } = useQuery({
    queryKey: ["countries"],
    queryFn: () => api.get<{ id: string; name: string; code: string; regions: { id: string; name: string }[] }[]>("/api/countries"),
  });

  // Fetch ingredient images (batch) when recipe loads
  const ingredientNames = recipe?.ingredients?.map((i) => i.name).filter(Boolean) || [];
  const { data: ingredientImages } = useQuery({
    queryKey: ["ingredient-images", ingredientNames.join(",")],
    queryFn: () =>
      api.post<Record<string, string>>("/api/ingredient-images/batch", {
        names: ingredientNames,
      }),
    enabled: ingredientNames.length > 0 && !isEditing,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Update form data when recipe changes
  useEffect(() => {
    if (recipe && !isEditing) {
      setFormData(recipe);
    }
  }, [recipe, isEditing]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Recipe>) => api.patch<Recipe>(`/api/recipes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipe", id] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["cookbook"] });
      queryClient.invalidateQueries({ queryKey: ["cookbooks"] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/recipes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      navigate("/recipes");
    },
  });

  const generateImageMutation = useMutation({
    mutationFn: async () => {
      if (!recipe) throw new Error("No recipe");
      const result = await api.post<GenerateImageResponse>("/api/images/generate", {
        title: recipe.title,
        description: recipe.description || undefined,
      });
      // Save the generated image URL to the recipe
      await api.patch(`/api/recipes/${id}`, { imageUrl: result.imageUrl });
      return result.imageUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipe", id] });
    },
  });

  const navigateToNextPending = async () => {
    try {
      const params = new URLSearchParams();
      params.set("status", "pending");
      params.set("limit", "1");
      params.set("sortBy", "createdAt");
      params.set("sortOrder", "asc");
      const result = await api.get<RecipesResponse>(`/api/recipes?${params.toString()}`);
      if (result.recipes && result.recipes.length > 0) {
        navigate(`/recipes/${result.recipes[0].id}`, { replace: true });
      } else {
        navigate("/recipes");
      }
    } catch {
      navigate("/recipes");
    }
  };

  const handleApprove = async () => {
    await updateMutation.mutateAsync({ status: "approved" });
    navigateToNextPending();
  };

  const handleReject = async () => {
    await updateMutation.mutateAsync({ status: "rejected" });
    navigateToNextPending();
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const breadcrumbs = [
    { label: "Accueil", href: "/dashboard" },
    { label: "Recettes", href: "/recipes" },
    { label: recipe?.title || "Recette" },
  ];

  if (isLoading) {
    return (
      <DashboardLayout breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (!recipe) {
    return (
      <DashboardLayout breadcrumbs={breadcrumbs}>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-gray-500 mb-4" />
          <h2 className="text-lg font-medium text-white">Recette non trouvee</h2>
          <Button asChild className="mt-4">
            <Link to="/recipes">Retour aux recettes</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const totalTime = (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);

  return (
    <DashboardLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-white/40 hover:text-white/70 h-8 w-8 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
            <div>
              {isEditing ? (
                <Input
                  value={formData.title || ""}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="glass-input text-2xl font-semibold h-auto py-1 px-2 text-white"
                />
              ) : (
                <h1 className="text-2xl font-bold text-white font-heading tracking-tight">{recipe.title}</h1>
              )}
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={recipe.status} />
                {recipe.category ? (
                  <Badge variant="secondary">{recipe.category}</Badge>
                ) : null}
              </div>
              {recipe.status === "pending" ? (
                <p className="text-xs text-white/50 mt-1">
                  Recette en attente de validation
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Annuler
                </Button>
                <GlassButton onClick={handleSave} disabled={updateMutation.isPending} variant="primary">
                  {updateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Sauvegarder
                </GlassButton>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Modifier
                </Button>
                {recipe.status !== "approved" ? (
                  <GlassButton onClick={handleApprove} disabled={updateMutation.isPending} variant="success">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approuver
                  </GlassButton>
                ) : null}
                {recipe.status !== "rejected" ? (
                  <GlassButton
                    onClick={handleReject}
                    disabled={updateMutation.isPending}
                    variant="destructive"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rejeter
                  </GlassButton>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* Recipe Image */}
        <div className="ct-card rounded-xl overflow-hidden">
          {recipe.imageUrl ? (
            <div className="relative aspect-video">
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-4 right-4"
                onClick={() => generateImageMutation.mutate()}
                disabled={generateImageMutation.isPending}
              >
                {generateImageMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Regenerer
              </Button>
            </div>
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <ImagePlus className="h-12 w-12 text-gray-500 mb-4" />
              <p className="text-gray-400 mb-4">Pas d'image</p>
              <GlassButton
                onClick={() => generateImageMutation.mutate()}
                disabled={generateImageMutation.isPending}
                variant="primary"
              >
                {generateImageMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generation...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generer une image
                  </>
                )}
              </GlassButton>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="ct-card p-6 rounded-xl">
              <h3 className="text-[15px] font-semibold text-white font-heading mb-4">Description</h3>
              {isEditing ? (
                <Textarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Description appetissante de la recette..."
                  className="glass-input text-white"
                />
              ) : (
                <p className="text-gray-400">
                  {recipe.description || "Pas de description"}
                </p>
              )}
            </div>

            {/* Ingredients */}
            <div className="ct-card p-6 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-white font-heading">
                  Ingredients ({recipe.ingredients?.length || 0})
                </h3>
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  {(formData.ingredients || []).map((ing: Ingredient, index: number) => (
                    <div key={index} className="flex items-center gap-2 bg-white/5 p-2 rounded-lg">
                      <Input
                        value={ing.quantity?.toString() || ""}
                        onChange={(e) => {
                          const updated = [...(formData.ingredients || [])];
                          updated[index] = { ...updated[index], quantity: parseFloat(e.target.value) || 0 };
                          setFormData({ ...formData, ingredients: updated });
                        }}
                        className="glass-input w-20 text-sm text-white"
                        placeholder="Qte"
                      />
                      <Input
                        value={ing.unit || ""}
                        onChange={(e) => {
                          const updated = [...(formData.ingredients || [])];
                          updated[index] = { ...updated[index], unit: e.target.value };
                          setFormData({ ...formData, ingredients: updated });
                        }}
                        className="glass-input w-16 text-sm text-white"
                        placeholder="Unite"
                      />
                      <Input
                        value={ing.name || ""}
                        onChange={(e) => {
                          const updated = [...(formData.ingredients || [])];
                          updated[index] = { ...updated[index], name: e.target.value };
                          setFormData({ ...formData, ingredients: updated });
                        }}
                        className="glass-input flex-1 text-sm text-white"
                        placeholder="Nom"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          const updated = (formData.ingredients || []).filter((_: Ingredient, i: number) => i !== index);
                          setFormData({ ...formData, ingredients: updated });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed"
                    onClick={() => {
                      const updated = [...(formData.ingredients || []), { name: "", quantity: 0, unit: "g", original_text: "" }];
                      setFormData({ ...formData, ingredients: updated });
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Ajouter un ingredient
                  </Button>
                </div>
              ) : recipe.ingredients && recipe.ingredients.length > 0 ? (
                <ul className="space-y-1">
                  {recipe.ingredients.map((ing: Ingredient, index: number) => {
                    const imgUrl = ingredientImages?.[ing.name.trim().toLowerCase()];
                    return (
                      <li
                        key={index}
                        className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        {/* Ingredient preview image */}
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.04] border border-white/[0.08]">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={ing.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-5 h-5 rounded-full skeleton-glass" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-center min-w-[60px] px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                          <span className="text-xs font-bold text-primary tabular-nums">
                            {ing.quantity}{ing.unit}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{ing.name}</p>
                          {ing.original_text && ing.original_text !== `${ing.quantity}${ing.unit} ${ing.name}` ? (
                            <p className="text-xs text-white/30 truncate">{ing.original_text}</p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-gray-400">Aucun ingredient</p>
              )}
            </div>

            {/* Instructions */}
            <div className="ct-card p-6 rounded-xl">
              <h3 className="text-[15px] font-semibold text-white font-heading mb-4">
                Instructions ({recipe.instructions?.length || 0})
              </h3>
              {isEditing ? (
                <div className="space-y-2">
                  {(formData.instructions || []).map((inst: Instruction, index: number) => (
                    <div key={index} className="flex items-start gap-2 bg-white/5 p-2 rounded-lg">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-sm flex-shrink-0 mt-1">
                        {index + 1}
                      </span>
                      <Textarea
                        value={inst.text || ""}
                        onChange={(e) => {
                          const updated = [...(formData.instructions || [])];
                          updated[index] = { ...updated[index], text: e.target.value, step: index + 1 };
                          setFormData({ ...formData, instructions: updated });
                        }}
                        className="glass-input flex-1 text-sm text-white"
                        rows={2}
                        placeholder="Instruction..."
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive mt-1"
                        onClick={() => {
                          const updated = (formData.instructions || []).filter((_: Instruction, i: number) => i !== index);
                          setFormData({ ...formData, instructions: updated });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed"
                    onClick={() => {
                      const nextStep = (formData.instructions || []).length + 1;
                      const updated = [...(formData.instructions || []), { step: nextStep, text: "", time_minutes: null }];
                      setFormData({ ...formData, instructions: updated });
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Ajouter une etape
                  </Button>
                </div>
              ) : recipe.instructions && recipe.instructions.length > 0 ? (
                <ol className="space-y-4">
                  {recipe.instructions.map((inst: Instruction, index: number) => (
                    <li key={index} className="flex gap-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-sm flex-shrink-0">
                        {inst.step}
                      </span>
                      <div className="pt-1">
                        <p className="text-white">
                          {inst.text}
                          {inst.temperature_celsius ? (
                            <span className="text-xs text-primary/80 font-medium ml-2">
                              {inst.temperature_celsius}°C ({inst.temperature_fahrenheit}°F)
                            </span>
                          ) : null}
                        </p>
                        {inst.time_minutes ? (
                          <p className="text-sm text-gray-400 mt-1">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {inst.time_minutes} min
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-gray-400">Aucune instruction</p>
              )}
            </div>

            {/* Tips */}
            {recipe.tips ? (
              <div className="ct-card p-6 rounded-xl">
                <h3 className="text-[15px] font-semibold text-white font-heading mb-4">Conseils du chef</h3>
                <p className="text-gray-400">{recipe.tips}</p>
              </div>
            ) : null}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="ct-card p-5 rounded-xl">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="icon-container p-2 rounded-xl mx-auto w-fit mb-2">
                    <Clock className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-lg font-semibold text-white mt-1">
                    {totalTime || "-"}<span className="text-sm font-normal text-gray-400">min</span>
                  </p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
                <div className="text-center">
                  <div className="icon-container p-2 rounded-xl mx-auto w-fit mb-2">
                    <Users className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-lg font-semibold text-white mt-1">{recipe.servings || "-"}</p>
                  <p className="text-xs text-gray-500">Portions</p>
                </div>
                <div className="text-center">
                  <div className="icon-container p-2 rounded-xl mx-auto w-fit mb-2">
                    <ChefHat className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-lg font-semibold text-white mt-1">
                    {recipe.ingredients?.length || 0}
                  </p>
                  <p className="text-xs text-gray-500">Ingredients</p>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="ct-card p-6 rounded-xl">
              <h3 className="text-[15px] font-semibold text-white font-heading mb-4">Metadonnees</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-500">Categorie</Label>
                  {isEditing ? (
                    <Select
                      value={formData.category || ""}
                      onValueChange={(v) => setFormData({ ...formData, category: v, subCategory: "" })}
                    >
                      <SelectTrigger className="mt-1 glass-input">
                        <SelectValue placeholder="Selectionner une categorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {(categories || []).map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium text-white">{recipe.category || "Non defini"}</p>
                  )}
                </div>

                <div>
                  <Label className="text-gray-500">Sous-categorie</Label>
                  {isEditing ? (
                    <Select
                      value={formData.subCategory || ""}
                      onValueChange={(v) => setFormData({ ...formData, subCategory: v })}
                    >
                      <SelectTrigger className="mt-1 glass-input">
                        <SelectValue placeholder="Selectionner une sous-categorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {(categories || [])
                          .find((cat) => cat.name === formData.category)
                          ?.subCategories.map((sub) => (
                            <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                          )) ?? []}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium text-white">{recipe.subCategory || "Non defini"}</p>
                  )}
                </div>

                <div>
                  <Label className="text-gray-500">Saison</Label>
                  {isEditing ? (
                    <Select
                      value={formData.season || undefined}
                      onValueChange={(v) => setFormData({ ...formData, season: v })}
                    >
                      <SelectTrigger className="mt-1 glass-input">
                        <SelectValue placeholder="Selectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {seasons.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium text-white">{recipe.season || "Non defini"}</p>
                  )}
                </div>

                <div>
                  <Label className="text-gray-500">Type de repas</Label>
                  {isEditing ? (
                    <Select
                      value={formData.mealType || undefined}
                      onValueChange={(v) => setFormData({ ...formData, mealType: v })}
                    >
                      <SelectTrigger className="mt-1 glass-input">
                        <SelectValue placeholder="Selectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {mealTypes.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium text-white">{recipe.mealType || "Non defini"}</p>
                  )}
                </div>

                <div>
                  <Label className="text-gray-500">Difficulte</Label>
                  {isEditing ? (
                    <Select
                      value={formData.difficulty || undefined}
                      onValueChange={(v) => setFormData({ ...formData, difficulty: v })}
                    >
                      <SelectTrigger className="mt-1 glass-input">
                        <SelectValue placeholder="Selectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="facile">Facile</SelectItem>
                        <SelectItem value="moyen">Moyen</SelectItem>
                        <SelectItem value="difficile">Difficile</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium text-white">{recipe.difficulty || "Non defini"}</p>
                  )}
                </div>

                {/* Country */}
                <div>
                  <Label className="text-gray-500">Pays</Label>
                  {isEditing ? (
                    <Select
                      value={formData.country || "France"}
                      onValueChange={(v) => setFormData({ ...formData, country: v, region: v !== "France" ? "" : formData.region })}
                    >
                      <SelectTrigger className="mt-1 glass-input border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {countriesData?.map((c) => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium text-white">{recipe.country || "Non defini"}</p>
                  )}
                </div>

                {/* Region (only if France) */}
                {isEditing && formData.country === "France" ? (
                  <div>
                    <Label className="text-gray-500">Region</Label>
                    <Select
                      value={formData.region || ""}
                      onValueChange={(v) => setFormData({ ...formData, region: v })}
                    >
                      <SelectTrigger className="mt-1 glass-input border-white/10 text-white">
                        <SelectValue placeholder="Selectionner une region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Aucune</SelectItem>
                        {countriesData?.find((c) => c.name === "France")?.regions.map((r) => (
                          <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div>
                  <Label className="text-gray-500">Type</Label>
                  {isEditing ? (
                    <Select
                      value={formData.type || "both"}
                      onValueChange={(v) => setFormData({ ...formData, type: v })}
                    >
                      <SelectTrigger className="mt-1 glass-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prive">Prive</SelectItem>
                        <SelectItem value="collectivite">Collectivite</SelectItem>
                        <SelectItem value="both">Les deux</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium text-white">
                      {recipe.type === "prive" ? "Prive" : recipe.type === "collectivite" ? "Collectivite" : "Les deux"}
                    </p>
                  )}
                </div>

                {!isEditing && recipe.country ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-white">{recipe.country}{recipe.region ? ` - ${recipe.region}` : ""}</span>
                  </div>
                ) : null}

                <div>
                  <Label className="text-gray-500">Regimes alimentaires</Label>
                  <div className="space-y-2 mt-2">
                    {[
                      { key: "is_vegetarian", label: "Vegetarien" },
                      { key: "is_vegan", label: "Vegan" },
                      { key: "is_gluten_free", label: "Sans gluten" },
                      { key: "is_lactose_free", label: "Sans produits laitiers" },
                      { key: "is_halal", label: "Halal" },
                      { key: "is_low_carb", label: "Faible en glucides" },
                      { key: "is_low_fat", label: "Faible en matieres grasses" },
                      { key: "is_high_protein", label: "Riche en proteines" },
                      { key: "is_mediterranean", label: "Mediterraneen" },
                      { key: "is_whole30", label: "Whole30" },
                      { key: "is_low_sodium", label: "Faible en sodium" },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2">
                        {isEditing ? (
                          <Checkbox
                            checked={(formData as unknown as Record<string, boolean>)[key] || false}
                            onCheckedChange={(c) => setFormData({ ...formData, [key]: !!c })}
                          />
                        ) : (
                          <span className={`h-4 w-4 rounded ${(recipe as unknown as Record<string, unknown>)[key] ? "bg-green-500" : "bg-white/10"}`} />
                        )}
                        <span className="text-sm text-white">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {recipe.dietTags && recipe.dietTags.length > 0 ? (
                  <div>
                    <Label className="text-gray-500">Tags regimes</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {recipe.dietTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Source */}
            <div className="ct-card p-6 rounded-xl">
              <h3 className="text-[15px] font-semibold text-white font-heading mb-4">Source</h3>
              <div className="space-y-2">
                {recipe.cookbook ? (
                  <Link
                    to={`/cookbooks/${recipe.cookbookId}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <BookOpen className="h-4 w-4" />
                    {recipe.cookbook.name}
                  </Link>
                ) : null}
                {recipe.sourcePage ? (
                  <p className="text-sm text-gray-400">Page {recipe.sourcePage}</p>
                ) : null}
                {recipe.originalTitle && recipe.originalTitle !== recipe.title ? (
                  <p className="text-sm text-gray-400">
                    Titre original: {recipe.originalTitle}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="ct-card p-6 rounded-xl border-destructive/20">
              <h3 className="text-[15px] font-semibold text-red-400 font-heading mb-4">Zone de danger</h3>
              <GlassButton
                variant="destructive"
                className="w-full"
                onClick={() => {
                  if (confirm("Etes-vous sur de vouloir supprimer cette recette ?")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer la recette
              </GlassButton>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
