import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  ChefHat,
  Info,
} from "lucide-react";
import type { Recipe, ChefExport } from "../../../backend/src/types";

interface RecipesResponse {
  recipes: Recipe[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function ExportPage() {
  const [exportMode, setExportMode] = useState<"all" | "select">("all");
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([]);
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [exportData, setExportData] = useState<ChefExport | null>(null);

  const { data: recipesData, isLoading: recipesLoading } = useQuery({
    queryKey: ["recipes", "approved"],
    queryFn: () =>
      api.get<RecipesResponse>("/api/recipes?status=approved&limit=1000"),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const options = {
        format,
        includeAll: exportMode === "all",
        recipeIds: exportMode === "select" ? selectedRecipes : undefined,
      };

      if (format === "csv") {
        const response = await api.raw("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
        });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recipes-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        return null;
      }

      const data = await api.post<ChefExport>("/api/export", options);
      setExportData(data);
      return data;
    },
  });

  const handleDownloadJson = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recipes-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const approvedRecipes = recipesData?.recipes || [];
  const selectedCount =
    exportMode === "all" ? approvedRecipes.length : selectedRecipes.length;

  return (
    <DashboardLayout
      title="Exporter les recettes"
      description="Exportez vos recettes au format 1000CHEFS"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Step 1: Select Recipes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                1
              </span>
              Sélectionner les recettes
            </CardTitle>
            <CardDescription>
              Choisissez les recettes à inclure dans l'export
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={exportMode}
              onValueChange={(v) => setExportMode(v as "all" | "select")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="cursor-pointer">
                  Toutes les recettes approuvées ({approvedRecipes.length})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="select" id="select" />
                <Label htmlFor="select" className="cursor-pointer">
                  Sélectionner manuellement
                </Label>
              </div>
            </RadioGroup>

            {exportMode === "select" && (
              <div className="mt-4">
                {recipesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : approvedRecipes.length > 0 ? (
                  <ScrollArea className="h-[300px] rounded-lg border p-4">
                    <div className="space-y-2">
                      {approvedRecipes.map((recipe) => (
                        <div
                          key={recipe.id}
                          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50"
                        >
                          <Checkbox
                            id={recipe.id}
                            checked={selectedRecipes.includes(recipe.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRecipes([...selectedRecipes, recipe.id]);
                              } else {
                                setSelectedRecipes(
                                  selectedRecipes.filter((id) => id !== recipe.id)
                                );
                              }
                            }}
                          />
                          <Label
                            htmlFor={recipe.id}
                            className="flex-1 cursor-pointer"
                          >
                            <span className="font-medium">{recipe.title}</span>
                            <span className="text-muted-foreground ml-2 text-sm">
                              {recipe.category || "Non catégorisé"}
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ChefHat className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    Aucune recette approuvée à exporter
                  </div>
                )}
                {selectedRecipes.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedRecipes.length} recette
                    {selectedRecipes.length > 1 ? "s" : ""} sélectionnée
                    {selectedRecipes.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Choose Format */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                2
              </span>
              Choisir le format
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as "json" | "csv")}
              className="grid grid-cols-2 gap-4"
            >
              <Label
                htmlFor="json"
                className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  format === "json"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="json" id="json" className="sr-only" />
                <FileJson className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">JSON</p>
                  <p className="text-sm text-muted-foreground">
                    Recommandé pour 1000CHEFS
                  </p>
                </div>
                {format === "json" && (
                  <CheckCircle2 className="h-5 w-5 text-primary ml-auto" />
                )}
              </Label>

              <Label
                htmlFor="csv"
                className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  format === "csv"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="csv" id="csv" className="sr-only" />
                <FileSpreadsheet className="h-8 w-8 text-success" />
                <div>
                  <p className="font-medium">CSV</p>
                  <p className="text-sm text-muted-foreground">
                    Compatible Excel
                  </p>
                </div>
                {format === "csv" && (
                  <CheckCircle2 className="h-5 w-5 text-primary ml-auto" />
                )}
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Preview */}
        {exportData && format === "json" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                  3
                </span>
                Aperçu
              </CardTitle>
              <CardDescription>
                {exportData.recipe_count} recette
                {exportData.recipe_count > 1 ? "s" : ""} prête
                {exportData.recipe_count > 1 ? "s" : ""} à l'export
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] rounded-lg border bg-muted/30">
                <pre className="p-4 text-xs">
                  {JSON.stringify(exportData.recipes.slice(0, 3), null, 2)}
                  {exportData.recipes.length > 3 && (
                    <span className="text-muted-foreground">
                      {"\n"}... et {exportData.recipes.length - 3} autres recettes
                    </span>
                  )}
                </pre>
              </ScrollArea>
              <Button onClick={handleDownloadJson} className="mt-4 w-full">
                <Download className="mr-2 h-4 w-4" />
                Télécharger le fichier JSON
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Box */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-primary">Format 1000CHEFS</p>
                <p className="text-muted-foreground mt-1">
                  Le format JSON est optimisé pour l'import dans la base de données 1000CHEFS
                  d'OptiMenu. Toutes les quantités sont en grammes et les instructions sont
                  reformulées pour éviter les problèmes de droits d'auteur.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export Button */}
        <Button
          onClick={() => exportMutation.mutate()}
          disabled={
            exportMutation.isPending ||
            selectedCount === 0 ||
            (exportMode === "select" && selectedRecipes.length === 0)
          }
          className="w-full"
          size="lg"
        >
          {exportMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Générer l'export ({selectedCount} recette
              {selectedCount > 1 ? "s" : ""})
            </>
          )}
        </Button>
      </div>
    </DashboardLayout>
  );
}
