import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
};

const textSizeClasses = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
};

export function Logo({ size = "md", showText = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src="/logo.png"
        alt="OptiRecipe"
        className={cn(sizeClasses[size], "object-contain")}
      />
      {showText && (
        <div>
          <h1 className={cn("font-bold", textSizeClasses[size])}>
            <span className="text-white">Opti</span>
            <span className="bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent">Recipe</span>
          </h1>
          {size !== "sm" && (
            <p className="text-sm text-white/60">Extraction de recettes</p>
          )}
        </div>
      )}
    </div>
  );
}

export function LogoIcon({ size = "md", className }: Omit<LogoProps, "showText">) {
  return (
    <img
      src="/logo.png"
      alt="OptiRecipe"
      className={cn(sizeClasses[size], "object-contain", className)}
    />
  );
}
