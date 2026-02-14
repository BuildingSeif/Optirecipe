import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export type GlassVariant = "default" | "primary" | "destructive" | "success" | "warning" | "ghost";
export type GlassSize = "sm" | "default" | "lg" | "icon";

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassVariant;
  size?: GlassSize;
  asChild?: boolean;
}

const variantMap: Record<GlassVariant, string> = {
  default: "",
  primary: "glass-btn-primary",
  destructive: "glass-btn-destructive",
  success: "glass-btn-success",
  warning: "glass-btn-warning",
  ghost: "glass-btn-ghost",
};

const sizeMap: Record<GlassSize, string> = {
  sm: "glass-btn-sm",
  default: "glass-btn-default",
  lg: "glass-btn-lg",
  icon: "glass-btn-icon",
};

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    const isGhost = variant === "ghost";

    if (asChild) {
      return (
        <Slot
          className={cn(
            "glass-btn inline-flex",
            variantMap[variant],
            sizeMap[size],
            className,
          )}
          ref={ref}
          {...props}
        >
          {React.isValidElement(children)
            ? React.cloneElement(children as React.ReactElement<{ className?: string; children?: React.ReactNode }>, {
                children: (
                  <>
                    <span className="btn-text">
                      {(children as React.ReactElement<{ children?: React.ReactNode }>).props.children}
                    </span>
                    {!isGhost && <div className="btn-shine" />}
                  </>
                ),
              })
            : children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(
          "glass-btn inline-flex",
          variantMap[variant],
          sizeMap[size],
          className,
        )}
        ref={ref}
        {...props}
      >
        <span className="btn-text [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0">
          {children}
        </span>
        {!isGhost && <div className="btn-shine" />}
      </button>
    );
  },
);
GlassButton.displayName = "GlassButton";

export { GlassButton };
