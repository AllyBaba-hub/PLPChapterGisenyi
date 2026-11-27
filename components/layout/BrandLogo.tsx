import { cn } from "@/lib/utils";

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/** Heart with an olive-sprig sapling: love, peace and growth. Uses the design tokens. */
export function BrandMark({ size = 40, className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="PLP Chapter Gisenyi logo"
    >
      <rect width="48" height="48" rx="12" className="fill-primary" />
      <path
        d="M24 39C24 39 9 30.5 9 20C9 15.2 12.6 12 16.8 12C20 12 22.7 13.8 24 16.4C25.3 13.8 28 12 31.2 12C35.4 12 39 15.2 39 20C39 30.5 24 39 24 39Z"
        className="fill-primary-foreground"
      />
      <path d="M24 33V21" className="stroke-primary" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <ellipse cx="24" cy="19" rx="1.8" ry="3.4" className="fill-primary" />
      <ellipse cx="20.4" cy="26.2" rx="3.6" ry="1.7" transform="rotate(-38 20.4 26.2)" className="fill-primary" />
      <ellipse cx="27.6" cy="23.2" rx="3.6" ry="1.7" transform="rotate(38 27.6 23.2)" className="fill-primary" />
    </svg>
  );
}

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export function BrandLogo({ size = 40, showWordmark = true, className }: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <BrandMark size={size} />
      {showWordmark ? (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-foreground">PLP Chapter Gisenyi</span>
          <span className="text-xs text-muted-foreground">Peace and Love Proclaimers</span>
        </span>
      ) : null}
    </span>
  );
}
