import { BRAND_MARK_PATH } from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

type BrandLockupProps = {
  size?: "sm" | "md";
  className?: string;
};

/** Shared brand treatment for public and account-entry screens. */
export function BrandLockup({ size = "md", className }: BrandLockupProps) {
  const isSmall = size === "sm";

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2 whitespace-nowrap", className)}>
      <img
        alt=""
        aria-hidden="true"
        className={isSmall ? "h-7 w-7" : "h-8 w-8"}
        src={BRAND_MARK_PATH}
      />
      <span className={isSmall ? "text-base font-bold text-foreground" : "text-xl font-bold text-foreground"}>
        Payslip Insights
      </span>
    </span>
  );
}
