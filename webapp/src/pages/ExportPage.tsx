import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { GlassButton } from "@/components/ui/glass-button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
  ChefHat,
  Info,
  Printer,
  Database,
  Table,
} from "lucide-react";
import type { Recipe, Cookbook, OptiRecipeExport } from "../../../backend/src/types";

interface RecipesResponse {
  recipes: Recipe[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type ExportFormat = "json" | "csv" | "pdf";

const formatOptions = [
  {
    value: "json" as ExportFormat,
    label: "JSON",
    description: "Donnees structurees pour integration logicielle",
    icon: FileJson,
    iconColor: "text-primary",
    useCase: "Import dans OptiMenu, API, bases de donnees",
    iconBg: "bg-primary/20",
  },
  {
    value: "csv" as ExportFormat,
    label: "CSV / Excel",
    description: "Tableau compatible avec Excel et Google Sheets",
    icon: FileSpreadsheet,
    iconColor: "text-emerald-400",
    useCase: "Analyse, inventaire, listes de courses",
    iconBg: "bg-emerald-500/20",
  },
  {
    value: "pdf" as ExportFormat,
    label: "PDF",
    description: "Fiches recettes imprimables haute qualite",
    icon: FileText,
    iconColor: "text-rose-400",
    useCase: "Impression cuisine, formation, partage",
    iconBg: "bg-rose-500/20",
  },
];

export default function ExportPage() {
  const [exportMode, setExportMode] = useState<"all" | "select">("all");
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportFormat>("json");
  const [exportData, setExportData] = useState<OptiRecipeExport | null>(null);
  const [statusFilter, setStatusFilter] = useState("approved");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cookbookFilter, setCookbookFilter] = useState("all");

  const { data: cookbooks } = useQuery({
    queryKey: ["cookbooks"],
    queryFn: () => api.get<Cookbook[]>("/api/cookbooks"),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ id: string; name: string; order: number }[]>("/api/categories"),
  });

  const { data: recipesData, isLoading: recipesLoading } = useQuery({
    queryKey: ["recipes", "export", statusFilter, typeFilter, categoryFilter, cookbookFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (cookbookFilter !== "all") params.set("cookbookId", cookbookFilter);
      params.set("limit", "1000");
      return api.get<RecipesResponse>(`/api/recipes?${params.toString()}`);
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const options: Record<string, unknown> = {
        format: format === "pdf" ? "json" : format,
        includeAll: exportMode === "all",
        recipeIds: exportMode === "select" ? selectedRecipes : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        cookbookId: cookbookFilter !== "all" ? cookbookFilter : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
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
        a.download = `optirecipe-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        return null;
      }

      const data = await api.post<OptiRecipeExport>("/api/export", options);
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
    a.download = `optirecipe-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!exportData) return;
    const recipes = exportData.recipes || [];
    generatePdfFromRecipes(recipes);
  };

  const generatePdfFromRecipes = (recipes: OptiRecipeExport["recipes"]) => {
    // Create a printable HTML document
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OptiRecipe - Export Recettes</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #fff;
            color: #1a1a1a;
            line-height: 1.6;
          }

          .recipe-card {
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 32px;
            margin: 24px;
            background: #fff;
          }

          .recipe-header {
            border-bottom: 2px solid #0080FF;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }

          .recipe-title {
            font-size: 24px;
            font-weight: 700;
            color: #0066FF;
            margin-bottom: 8px;
          }

          .recipe-meta {
            display: flex;
            gap: 24px;
            font-size: 14px;
            color: #6b7280;
          }

          .recipe-meta span {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #0080FF;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .ingredients-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 24px;
          }

          .ingredient {
            display: flex;
            justify-content: space-between;
            padding: 8px 12px;
            background: #f9fafb;
            border-radius: 6px;
            font-size: 14px;
          }

          .ingredient-name { font-weight: 500; }
          .ingredient-qty { color: #6b7280; }

          .instructions {
            margin-bottom: 24px;
          }

          .instruction {
            display: flex;
            gap: 16px;
            margin-bottom: 12px;
          }

          .step-number {
            flex-shrink: 0;
            width: 28px;
            height: 28px;
            background: linear-gradient(135deg, #00D4FF, #0066FF);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 600;
          }

          .step-text {
            font-size: 14px;
            color: #374151;
          }

          .cover-page {
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            page-break-after: always;
          }

          .cover-logo {
            font-size: 48px;
            font-weight: 700;
            margin-bottom: 16px;
          }

          .cover-logo .opti { color: #1a1a1a; }
          .cover-logo .recipe { color: #0080FF; }

          .cover-subtitle {
            font-size: 18px;
            color: #6b7280;
            margin-bottom: 32px;
          }

          .cover-count {
            font-size: 64px;
            font-weight: 700;
            color: #0080FF;
          }

          .cover-label {
            font-size: 16px;
            color: #9ca3af;
            text-transform: uppercase;
            letter-spacing: 2px;
          }

          .cover-date {
            position: absolute;
            bottom: 48px;
            font-size: 14px;
            color: #9ca3af;
          }

          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .recipe-card { box-shadow: none; border: 1px solid #e5e7eb; }
          }
        </style>
      </head>
      <body>
        <div class="cover-page">
          <div class="cover-logo">
            <span class="opti">Opti</span><span class="recipe">Recipe</span>
          </div>
          <p class="cover-subtitle">Collection de Recettes</p>
          <div class="cover-count">${recipes.length}</div>
          <div class="cover-label">Recettes</div>
          <div class="cover-date">Exporte le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
        </div>

        ${recipes.map((recipe) => `
          <div class="recipe-card">
            <div class="recipe-header">
              <h1 class="recipe-title">${recipe.title}</h1>
              <div class="recipe-meta">
                ${recipe.prep_time_minutes ? `<span>Prep: ${recipe.prep_time_minutes} min</span>` : ""}
                ${recipe.cook_time_minutes ? `<span>Cuisson: ${recipe.cook_time_minutes} min</span>` : ""}
                ${recipe.servings ? `<span>Portions: ${recipe.servings}</span>` : ""}
                ${recipe.category ? `<span>${recipe.category}</span>` : ""}
              </div>
            </div>

            ${recipe.description ? `<p style="margin-bottom: 24px; color: #4b5563; font-style: italic;">${recipe.description}</p>` : ""}

            <div class="section-title">Ingredients</div>
            <div class="ingredients-grid">
              ${recipe.ingredients.map((ing) => `
                <div class="ingredient">
                  <span class="ingredient-name">${ing.name}</span>
                  <span class="ingredient-qty">${ing.quantity} ${ing.unit}</span>
                </div>
              `).join("")}
            </div>

            <div class="section-title">Instructions</div>
            <div class="instructions">
              ${recipe.instructions.map((inst) => `
                <div class="instruction">
                  <span class="step-number">${inst.step}</span>
                  <span class="step-text">${inst.text}</span>
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for fonts to load then print
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const filteredRecipes = recipesData?.recipes || [];
  const selectedCount =
    exportMode === "all" ? filteredRecipes.length : selectedRecipes.length;

  const toggleSelectAll = () => {
    if (selectedRecipes.length === filteredRecipes.length) {
      setSelectedRecipes([]);
    } else {
      setSelectedRecipes(filteredRecipes.map((r) => r.id));
    }
  };

  return (
    <DashboardLayout title="Exporter">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Step 1: Select Recipes */}
        <div className="glass-card-static p-8 rounded-2xl">
          <div className="mb-6">
            <h3 className="flex items-center gap-3 text-lg font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-white text-sm font-bold">
                1
              </span>
              <span className="bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent">
                Selectionner les recettes
              </span>
            </h3>
            <p className="text-white/60 mt-2 ml-11">
              Filtrez et choisissez les recettes a inclure dans l'export
            </p>
          </div>

          {/* Filter controls */}
          <div className="flex flex-wrap gap-3 mb-6 ml-11">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] glass-card-static border-none text-sm font-semibold text-white">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approuvees</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="all">Toutes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] glass-card-static border-none text-sm font-semibold text-white">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="prive">Prive</SelectItem>
                <SelectItem value="collectivite">Collectivite</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] glass-card-static border-none text-sm font-semibold text-white">
                <SelectValue placeholder="Categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes categories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {cookbooks && cookbooks.length > 0 ? (
              <Select value={cookbookFilter} onValueChange={setCookbookFilter}>
                <SelectTrigger className="w-[180px] glass-card-static border-none text-sm font-semibold text-white">
                  <SelectValue placeholder="Livre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les livres</SelectItem>
                  {cookbooks.map((cb: Cookbook) => (
                    <SelectItem key={cb.id} value={cb.id}>{cb.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          <p className="text-white/60 mt-2 ml-11 mb-4">
            {selectedCount} recette{selectedCount > 1 ? "s" : ""} a exporter
          </p>

          <div className="space-y-4 ml-11">
            <RadioGroup
              value={exportMode}
              onValueChange={(v) => setExportMode(v as "all" | "select")}
              className="space-y-3"
            >
              <Label
                htmlFor="all"
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  exportMode === "all"
                    ? "border-primary bg-primary/10"
                    : "border-white/10 hover:border-white/20 bg-white/5"
                }`}
              >
                <RadioGroupItem value="all" id="all" className="sr-only" />
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">Toutes les recettes filtrees</p>
                  <p className="text-sm text-white/60">{filteredRecipes.length} recettes disponibles</p>
                </div>
                {exportMode === "all" ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : null}
              </Label>

              <Label
                htmlFor="select"
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  exportMode === "select"
                    ? "border-primary bg-primary/10"
                    : "border-white/10 hover:border-white/20 bg-white/5"
                }`}
              >
                <RadioGroupItem value="select" id="select" className="sr-only" />
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
                  <Table className="h-5 w-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">Selection manuelle</p>
                  <p className="text-sm text-white/60">Choisir les recettes specifiques</p>
                </div>
                {exportMode === "select" ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : null}
              </Label>
            </RadioGroup>

            {exportMode === "select" ? (
              <div className="mt-4">
                {recipesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredRecipes.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleSelectAll}
                        className="text-primary hover:text-primary/80"
                      >
                        {selectedRecipes.length === filteredRecipes.length
                          ? "Tout deselectionner"
                          : "Tout selectionner"}
                      </Button>
                      <span className="text-sm text-white/60">
                        {selectedRecipes.length} / {filteredRecipes.length}
                      </span>
                    </div>
                    <ScrollArea className="h-[280px] bg-gradient-to-br from-[#0a1628] to-[#0d1f3c] rounded-xl p-4 border border-white/10">
                      <div className="space-y-1">
                        {filteredRecipes.map((recipe) => (
                          <div
                            key={recipe.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                              selectedRecipes.includes(recipe.id)
                                ? "bg-primary/20 border border-primary/30"
                                : "hover:bg-white/5"
                            }`}
                            onClick={() => {
                              if (selectedRecipes.includes(recipe.id)) {
                                setSelectedRecipes(selectedRecipes.filter((id) => id !== recipe.id));
                              } else {
                                setSelectedRecipes([...selectedRecipes, recipe.id]);
                              }
                            }}
                          >
                            <Checkbox
                              id={recipe.id}
                              checked={selectedRecipes.includes(recipe.id)}
                              className="pointer-events-none"
                            />
                            <ChefHat className="h-4 w-4 text-primary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-white truncate block">{recipe.title}</span>
                            </div>
                            <span className="text-xs text-white/50 bg-white/10 px-2 py-1 rounded">
                              {recipe.category || "\u2014"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="text-center py-12 bg-white/5 rounded-xl">
                    <ChefHat className="h-12 w-12 mx-auto text-primary/50 mb-3" />
                    <p className="text-white/60 font-medium">Aucune recette trouvee</p>
                    <p className="text-sm text-white/40 mt-1">Modifiez les filtres pour voir des recettes</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Step 2: Choose Format */}
        <div className="glass-card-static p-8 rounded-2xl">
          <div className="mb-6">
            <h3 className="flex items-center gap-3 text-lg font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-white text-sm font-bold">
                2
              </span>
              <span className="bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent">
                Choisir le format
              </span>
            </h3>
            <p className="text-white/60 mt-2 ml-11">
              Selectionnez le format adapte a votre usage
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 ml-11">
            {formatOptions.map((option) => (
              <Label
                key={option.value}
                htmlFor={option.value}
                className={`relative flex flex-col p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  format === option.value
                    ? "border-primary bg-primary/10"
                    : "border-white/10 hover:border-white/20 bg-white/5"
                }`}
              >
                <RadioGroup
                  value={format}
                  onValueChange={(v) => setFormat(v as ExportFormat)}
                >
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="sr-only"
                  />
                </RadioGroup>

                {format === option.value ? (
                  <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-primary" />
                ) : null}

                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${option.iconBg} mb-4`}>
                  <option.icon className={`h-6 w-6 ${option.iconColor}`} />
                </div>

                <p className="font-semibold text-white mb-1">{option.label}</p>
                <p className="text-xs text-white/60 mb-3">{option.description}</p>
                <p className="text-xs text-white/40 mt-auto">{option.useCase}</p>
              </Label>
            ))}
          </div>
        </div>

        {/* Preview for JSON/PDF */}
        {exportData && (format === "json" || format === "pdf") ? (
          <div className="glass-card-static p-8 rounded-2xl">
            <div className="mb-6">
              <h3 className="flex items-center gap-3 text-lg font-semibold">
                <span className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-white text-sm font-bold">
                  3
                </span>
                <span className="bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent">
                  {format === "pdf" ? "Telecharger" : "Apercu"}
                </span>
              </h3>
              <p className="text-white/60 mt-2 ml-11">
                {exportData.export_info.total_recipes} recette{exportData.export_info.total_recipes > 1 ? "s" : ""} prete{exportData.export_info.total_recipes > 1 ? "s" : ""} a l'export
              </p>
            </div>

            <div className="ml-11">
              {format === "json" ? (
                <>
                  <ScrollArea className="h-[250px] bg-gradient-to-br from-[#0a1628] to-[#0d1f3c] rounded-xl border border-white/10">
                    <pre className="p-4 text-xs text-white/70 font-mono">
                      {JSON.stringify(exportData.recipes.slice(0, 2), null, 2)}
                      {exportData.recipes.length > 2 ? (
                        <span className="text-white/40">
                          {"\n"}... et {exportData.recipes.length - 2} autres recettes
                        </span>
                      ) : null}
                    </pre>
                  </ScrollArea>
                  <GlassButton onClick={handleDownloadJson} variant="primary" size="lg" className="mt-4 w-full">
                    <Download className="mr-2 h-5 w-5" />
                    Telecharger le fichier JSON
                  </GlassButton>
                </>
              ) : null}

              {format === "pdf" ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-[#0a1628] to-[#0d1f3c] rounded-xl p-6 border border-white/10 text-center">
                    <Printer className="h-12 w-12 mx-auto text-rose-400 mb-4" />
                    <p className="text-white font-semibold mb-2">Fiches recettes professionnelles</p>
                    <p className="text-sm text-white/60">
                      Format A4 optimise pour impression, avec mise en page soignee
                    </p>
                  </div>
                  <GlassButton onClick={handleDownloadPdf} variant="primary" size="lg" className="w-full">
                    <Printer className="mr-2 h-5 w-5" />
                    Generer et imprimer le PDF
                  </GlassButton>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Info Box */}
        <div className="glass-card-static p-6 rounded-2xl border border-primary/20 bg-primary/5">
          <div className="flex gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 flex-shrink-0">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-primary mb-1">Format OptiMenu</p>
              <p className="text-sm text-white/70 leading-relaxed">
                Le format JSON est optimise pour l'import dans OptiMenu.
                Toutes les quantites sont en grammes, les informations dietetiques sont incluses,
                et les instructions sont reformulees pour respecter les droits d'auteur.
              </p>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <GlassButton
          onClick={() => exportMutation.mutate()}
          disabled={
            exportMutation.isPending ||
            selectedCount === 0 ||
            (exportMode === "select" && selectedRecipes.length === 0)
          }
          variant="primary"
          size="lg"
          className="w-full"
        >
          {exportMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Generation en cours...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Generer l'export ({selectedCount} recette{selectedCount > 1 ? "s" : ""})
            </>
          )}
        </GlassButton>
      </div>
    </DashboardLayout>
  );
}
