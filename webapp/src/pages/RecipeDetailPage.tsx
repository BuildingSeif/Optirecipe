import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import type { Recipe, Ingredient, Instruction } from "../../../backend/src/types";

const categories = [
  { value: "entrée", label: "Entrée" },
  { value: "plat", label: "Plat" },
  { value: "dessert", label: "Dessert" },
  { value: "petit-déjeuner", label: "Petit-déjeuner" },
  { value: "accompagnement", label: "Accompagnement" },
  { value: "sauce", label: "Sauce" },
  { value: "boisson", label: "Boisson" },
];

const seasons = [
  { value: "printemps", label: "Printemps" },
  { value: "été", label: "Été" },
  { value: "automne", label: "Automne" },
  { value: "hiver", label: "Hiver" },
  { value: "toutes", label: "Toutes saisons" },
];

const mealTypes = [
  { value: "déjeuner", label: "Déjeuner" },
  { value: "dîner", label: "Dîner" },
  { value: "petit-déjeuner", label: "Petit-déjeuner" },
  { value: "goûter", label: "Goûter" },
  { value: "brunch", label: "Brunch" },
];

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    pending: { label: "En attente", className: "bg-warning/10 text-warning border-warning/20" },
    approved: { label: "Approuvée", className: "bg-success/10 text-success border-success/20" },
    rejected: { label: "Rejetée", className: "bg-destructive/10 text-destructive border-destructive/20" },
    needs_review: { label: "À revoir", className: "bg-warning/10 text-warning border-warning/20" },
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
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!recipe) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium">Recette non trouvée</h2>
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
                  className="text-2xl font-semibold h-auto py-1 px-2"
                />
              ) : (
                <h1 className="text-2xl font-semibold">{recipe.title}</h1>
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

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Description appétissante de la recette..."
                  />
                ) : (
                  <p className="text-muted-foreground">
                    {recipe.description || "Pas de description"}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Ingredients */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Ingrédients ({recipe.ingredients?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recipe.ingredients && recipe.ingredients.length > 0 ? (
                  <ul className="space-y-2">
                    {recipe.ingredients.map((ing: Ingredient, index: number) => (
                      <li
                        key={index}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <span className="font-medium">{ing.name}</span>
                        <span className="text-muted-foreground">
                          {ing.quantity} {ing.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Aucun ingrédient</p>
                )}
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Instructions ({recipe.instructions?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recipe.instructions && recipe.instructions.length > 0 ? (
                  <ol className="space-y-4">
                    {recipe.instructions.map((inst: Instruction, index: number) => (
                      <li key={index} className="flex gap-4">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
                          {inst.step}
                        </span>
                        <div className="pt-1">
                          <p>{inst.text}</p>
                          {inst.time_minutes && (
                            <p className="text-sm text-muted-foreground mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {inst.time_minutes} min
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted-foreground">Aucune instruction</p>
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            {recipe.tips && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Conseils du chef</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{recipe.tips}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardContent className="p-4 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <Clock className="h-5 w-5 mx-auto text-muted-foreground" />
                  <p className="text-lg font-semibold mt-1">
                    {totalTime || "-"}<span className="text-sm font-normal">min</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="text-center">
                  <Users className="h-5 w-5 mx-auto text-muted-foreground" />
                  <p className="text-lg font-semibold mt-1">{recipe.servings || "-"}</p>
                  <p className="text-xs text-muted-foreground">Portions</p>
                </div>
                <div className="text-center">
                  <ChefHat className="h-5 w-5 mx-auto text-muted-foreground" />
                  <p className="text-lg font-semibold mt-1">
                    {recipe.ingredients?.length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Ingrédients</p>
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Métadonnées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Catégorie</Label>
                  {isEditing ? (
                    <Select
                      value={formData.category || undefined}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Sélectionner" />
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
                    <p className="font-medium">{recipe.category || "Non défini"}</p>
                  )}
                </div>

                <div>
                  <Label className="text-muted-foreground">Saison</Label>
                  {isEditing ? (
                    <Select
                      value={formData.season || undefined}
                      onValueChange={(v) => setFormData({ ...formData, season: v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Sélectionner" />
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
                    <p className="font-medium">{recipe.season || "Non défini"}</p>
                  )}
                </div>

                <div>
                  <Label className="text-muted-foreground">Type de repas</Label>
                  {isEditing ? (
                    <Select
                      value={formData.mealType || undefined}
                      onValueChange={(v) => setFormData({ ...formData, mealType: v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Sélectionner" />
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
                    <p className="font-medium">{recipe.mealType || "Non défini"}</p>
                  )}
                </div>

                {recipe.region && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{recipe.region}</span>
                  </div>
                )}

                {recipe.dietTags && recipe.dietTags.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Régimes</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {recipe.dietTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Source */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Source</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
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
                  <p className="text-sm text-muted-foreground">Page {recipe.sourcePage}</p>
                )}
                {recipe.originalTitle && recipe.originalTitle !== recipe.title && (
                  <p className="text-sm text-muted-foreground">
                    Titre original: {recipe.originalTitle}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Zone de danger</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    if (confirm("Êtes-vous sûr de vouloir supprimer cette recette ?")) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer la recette
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
