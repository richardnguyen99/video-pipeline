import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/libs/utils";

export interface EntityLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  variant?: "single" | "chip";
}

export function EntityLink({ to, children, className, variant = "chip" }: EntityLinkProps) {
  return (
    <Link
      to={to as "/"}
      className={cn(variant === "single" && "text-primary underline-offset-2 hover:underline", className)}
    >
      {children}
    </Link>
  );
}
