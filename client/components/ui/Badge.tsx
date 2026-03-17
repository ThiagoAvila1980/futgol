import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand-600 text-white",
        secondary: "border-transparent bg-navy-100 text-navy-800",
        destructive: "border-transparent bg-red-600 text-white",
        outline: "text-navy-700 border-navy-200",
        success: "border-transparent bg-green-100 text-green-800",
        warning: "border-transparent bg-yellow-100 text-yellow-800",
        info: "border-transparent bg-blue-100 text-blue-800",
        brand: "border-brand-200 bg-brand-50 text-brand-700",
        accent: "border-accent-400/30 bg-accent-400/10 text-accent-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "brand" | "accent";
  className?: string;
  children?: React.ReactNode;
}

function Badge({ className, variant, children }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)}>{children}</div>
  );
}

export { Badge, badgeVariants };
