import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import type { Recipe, Ingredient, Instruction, GenerateImageResponse } from "../../../backend/src/types";

const categories = [
  { value: "entree", label: "Entree" },
  { value: "plat", label: "Plat" },
  { value: "dessert", label: "Dessert" },
  { value: "petit-dejeuner", label: "Petit-dejeuner" },
  { value: "accompagnement", label: "Accompagnement" },
  { value: "sauce", label: "Sauce" },
  { value: "boisson", label: "Boisson" },
];

const seasons = [
  { value: "printemps", label: "Printemps" },
  { value: "ete", label: "Ete" },
  { value: "automne", label: "Automne" },
  { value: "hiver", label: "Hiver" },
  { value: "toutes", label: "Toutes saisons" },
];

const mealTypes = [
  { value: "dejeuner", label: "Dejeuner" },
  { value: "diner", label: "Diner" },
  { value: "petit-dejeuner", label: "Petit-dejeuner" },
  { value: "gouter", label: "Gouter" },
  { value: "brunch", label: "Brunch" },
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

  const handleApprove = () => {
    updateMutation.mutate({ status: "approved" });
  };

  const handleReject = () => {
    updateMutation.mutate({ status: "rejected" });
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (!recipe) {
    return (
      <DashboardLayout>
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
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/recipes">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              {isEditing ? (
                <Input
                  value={formData.title || ""}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="glass-input text-2xl font-semibold h-auto py-1 px-2 text-white"
                />
              ) : (
                <h1 className="text-2xl font-semibold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent">{recipe.title}</h1>
              )}
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={recipe.status} />
                {recipe.category && (
                  <Badge variant="secondary">{recipe.category}</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Sauvegarder
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Modifier
                </Button>
                {recipe.status !== "approved" && (
                  <Button onClick={handleApprove} disabled={updateMutation.isPending}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approuver
                  </Button>
                )}
                {recipe.status !== "rejected" && (
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={updateMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rejeter
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Recipe Image */}
        <div className="glass-card-static rounded-2xl overflow-hidden">
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
              <Button
                onClick={() => generateImageMutation.mutate()}
                disabled={generateImageMutation.isPending}
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
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="glass-card-static p-8 rounded-2xl">
              <h3 className="text-base font-semibold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent mb-4">Description</h3>
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
            <div className="glass-card-static p-8 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent">
                  Ingredients ({recipe.ingredients?.length || 0})
                </h3>
              </div>
              {recipe.ingredients && recipe.ingredients.length > 0 ? (
                <ul className="space-y-1">
                  {recipe.ingredients.map((ing: Ingredient, index: number) => (
                    <li
                      key={index}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center justify-center min-w-[70px] px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                        <span className="text-sm font-bold text-primary tabular-nums">
                          {ing.quantity}{ing.unit}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{ing.name}</p>
                        {ing.original_text && ing.original_text !== `${ing.quantity}${ing.unit} ${ing.name}` ? (
                          <p className="text-xs text-gray-500 truncate">{ing.original_text}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">Aucun ingredient</p>
              )}
            </div>

            {/* Instructions */}
            <div className="glass-card-static p-8 rounded-2xl">
              <h3 className="text-base font-semibold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent mb-4">
                Instructions ({recipe.instructions?.length || 0})
              </h3>
              {recipe.instructions && recipe.instructions.length > 0 ? (
                <ol className="space-y-4">
                  {recipe.instructions.map((inst: Instruction, index: number) => (
                    <li key={index} className="flex gap-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-sm flex-shrink-0">
                        {inst.step}
                      </span>
                      <div className="pt-1">
                        <p className="text-white">{inst.text}</p>
                        {inst.time_minutes && (
                          <p className="text-sm text-gray-400 mt-1">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {inst.time_minutes} min
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-gray-400">Aucune instruction</p>
              )}
            </div>

            {/* Tips */}
            {recipe.tips && (
              <div className="glass-card-static p-8 rounded-2xl">
                <h3 className="text-base font-semibold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent mb-4">Conseils du chef</h3>
                <p className="text-gray-400">{recipe.tips}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="glass-card-static p-6 rounded-2xl">
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
            <div className="glass-card-static p-8 rounded-2xl">
              <h3 className="text-base font-semibold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent mb-4">Metadonnees</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-500">Categorie</Label>
                  {isEditing ? (
                    <Select
                      value={formData.category || undefined}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger className="mt-1 glass-input">
                        <SelectValue placeholder="Selectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium text-white">{recipe.category || "Non defini"}</p>
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

                {recipe.region && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-white">{recipe.region}</span>
                  </div>
                )}

                {recipe.dietTags && recipe.dietTags.length > 0 && (
                  <div>
                    <Label className="text-gray-500">Regimes</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {recipe.dietTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Source */}
            <div className="glass-card-static p-8 rounded-2xl">
              <h3 className="text-base font-semibold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent mb-4">Source</h3>
              <div className="space-y-2">
                {recipe.cookbook && (
                  <Link
                    to={`/cookbooks/${recipe.cookbookId}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <BookOpen className="h-4 w-4" />
                    {recipe.cookbook.name}
                  </Link>
                )}
                {recipe.sourcePage && (
                  <p className="text-sm text-gray-400">Page {recipe.sourcePage}</p>
                )}
                {recipe.originalTitle && recipe.originalTitle !== recipe.title && (
                  <p className="text-sm text-gray-400">
                    Titre original: {recipe.originalTitle}
                  </p>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="glass-card-static p-8 rounded-2xl border border-destructive/20">
              <h3 className="text-base font-semibold text-destructive mb-4">Zone de danger</h3>
              <Button
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
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
