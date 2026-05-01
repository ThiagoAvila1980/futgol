import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-heading font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-offset-2 whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/20 hover:shadow-brand-600/40 focus-visible:ring-brand-600",
        secondary:
          "bg-navy-800 hover:bg-navy-900 text-white shadow-lg shadow-navy-800/20 hover:shadow-navy-800/40 focus-visible:ring-navy-800",
        outline:
          "border-2 border-navy-200 hover:border-brand-600 text-navy-700 hover:text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-500",
        ghost:
          "text-navy-600 hover:bg-navy-100 hover:text-navy-900 focus-visible:ring-navy-500",
        danger:
          "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 focus-visible:ring-red-600",
        brand:
          "bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/20 focus-visible:ring-brand-500",
        link: "text-brand-600 underline-offset-4 hover:underline focus-visible:ring-brand-500",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-5 py-2.5 text-sm",
        lg: "px-6 py-3.5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/** Radix Slot requires exactly one element child; strip whitespace-only text from JSX formatting. */
function slotChild(children: React.ReactNode): React.ReactNode {
  const nodes = React.Children.toArray(children).filter(
    (c) => !(typeof c === "string" && c.trim() === "")
  );
  return nodes.length === 1 ? nodes[0] : children;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {slotChild(children)}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!isLoading && leftIcon && (
          <span className="flex-shrink-0">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
