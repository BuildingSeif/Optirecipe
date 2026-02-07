import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/20 text-primary",
        secondary: "border-white/20 bg-white/10 text-gray-300",
        destructive: "border-destructive/30 bg-destructive/20 text-destructive",
        outline: "border-white/20 bg-transparent text-gray-300",
        success: "border-success/30 bg-success/20 text-success",
        warning: "border-warning/30 bg-warning/20 text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
