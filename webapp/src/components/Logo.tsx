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

// Logo URL from Vibecode IMAGES tab - update this when image is uploaded
const LOGO_URL = import.meta.env.VITE_LOGO_URL || null;

export function Logo({ size = "md", showText = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {LOGO_URL ? (
        <img
          src={LOGO_URL}
          alt="OptiRecipe"
          className={cn(sizeClasses[size], "object-contain")}
        />
      ) : (
        <div
          className={cn(
            sizeClasses[size],
            "icon-container rounded-xl flex items-center justify-center"
          )}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={cn("w-2/3 h-2/3 text-primary")}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3L14.5 8.5L20.5 9.5L16 14L17.5 20L12 17L6.5 20L8 14L3.5 9.5L9.5 8.5L12 3Z" />
          </svg>
        </div>
      )}
      {showText && (
        <div>
          <h1 className={cn("font-bold text-white", textSizeClasses[size])}>
            OptiRecipe
          </h1>
          {size !== "sm" && (
            <p className="text-sm text-gray-400">Extraction de recettes</p>
          )}
        </div>
      )}
    </div>
  );
}

export function LogoIcon({ size = "md", className }: Omit<LogoProps, "showText">) {
  return (
    <>
      {LOGO_URL ? (
        <img
          src={LOGO_URL}
          alt="OptiRecipe"
          className={cn(sizeClasses[size], "object-contain", className)}
        />
      ) : (
        <div
          className={cn(
            sizeClasses[size],
            "icon-container rounded-xl flex items-center justify-center",
            className
          )}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-2/3 h-2/3 text-primary"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3L14.5 8.5L20.5 9.5L16 14L17.5 20L12 17L6.5 20L8 14L3.5 9.5L9.5 8.5L12 3Z" />
          </svg>
        </div>
      )}
    </>
  );
}
