interface SofascoreLogoProps {
  className?: string;
  size?: number;
}

export function SofascoreLogo({ className, size = 20 }: SofascoreLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Sofascore-style "S" mark with two overlapping rectangles */}
      <rect x="4" y="4" width="11" height="11" rx="2" fill="currentColor" />
      <rect x="9" y="9" width="11" height="11" rx="2" fill="currentColor" opacity="0.65" />
    </svg>
  );
}
