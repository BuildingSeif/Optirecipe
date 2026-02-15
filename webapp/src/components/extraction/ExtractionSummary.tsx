import { DollarSign, BarChart3, Filter, AlertTriangle, Copy, Zap } from "lucide-react";

interface ExtractionSummaryProps {
  processingLog: string[];
  totalPages: number;
  recipesExtracted: number;
  costData?: Record<string, unknown> | null;
}

export default function ExtractionSummary({ processingLog, totalPages, recipesExtracted, costData }: ExtractionSummaryProps) {
  // Parse summary from processing log - look for the "=== RESUME:" line
  const summaryLine = processingLog.find(l => l.startsWith("=== RESUME:"));

  // Try to parse from costData first (from SSE), then fall back to log parsing
  let stats = {
    pagesProcessed: totalPages,
    pagesSkipped: 0,
    recipes: recipesExtracted,
    needsReview: 0,
    duplicatesRemoved: 0,
    estimatedCost: 0,
  };

  if (costData) {
    stats = {
      pagesProcessed: (costData.totalPages as number) || totalPages,
      pagesSkipped: (costData.pagesSkipped as number) || 0,
      recipes: (costData.recipesExtracted as number) || recipesExtracted,
      needsReview: (costData.recipesNeedsReview as number) || 0,
      duplicatesRemoved: (costData.duplicatesRemoved as number) || 0,
      estimatedCost: (costData.estimatedCost as number) || 0,
    };
  } else if (summaryLine) {
    // Parse: "=== RESUME: 75 pages, 12 sautees, 54 recettes, 3 a revoir, 2 doublons, cout ~$0.87 ==="
    const nums = summaryLine.match(/(\d+\.?\d*)/g);
    if (nums && nums.length >= 6) {
      stats.pagesProcessed = parseInt(nums[0]);
      stats.pagesSkipped = parseInt(nums[1]);
      stats.recipes = parseInt(nums[2]);
      stats.needsReview = parseInt(nums[3]);
      stats.duplicatesRemoved = parseInt(nums[4]);
      stats.estimatedCost = parseFloat(nums[5]);
    }
  }

  if (!summaryLine && !costData) return null;

  const statItems = [
    { icon: BarChart3, label: "Pages analysees", value: stats.pagesProcessed, color: "text-blue-400" },
    { icon: Filter, label: "Pages filtrees (IA)", value: stats.pagesSkipped, color: "text-cyan-400" },
    { icon: Zap, label: "Recettes extraites", value: stats.recipes, color: "text-emerald-400" },
    { icon: AlertTriangle, label: "A revoir", value: stats.needsReview, color: "text-amber-400" },
    { icon: Copy, label: "Doublons supprimes", value: stats.duplicatesRemoved, color: "text-violet-400" },
    { icon: DollarSign, label: "Cout estime", value: `$${stats.estimatedCost.toFixed(2)}`, color: "text-green-400" },
  ];

  return (
    <div className="ct-card rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-white/80 font-heading">Rapport d'extraction</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {statItems.map((item) => (
          <div key={item.label} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <item.icon className={`h-3 w-3 ${item.color}`} />
              <span className="text-[10px] text-white/40 uppercase tracking-wider">{item.label}</span>
            </div>
            <p className={`text-lg font-bold ${item.color}`}>
              {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
            </p>
          </div>
        ))}
      </div>

      {stats.pagesSkipped > 0 ? (
        <p className="text-[11px] text-white/30 text-center">
          Le pre-filtre IA a economise ~${(stats.pagesSkipped * 0.01).toFixed(2)} en sautant {stats.pagesSkipped} pages non-recettes
        </p>
      ) : null}
    </div>
  );
}
