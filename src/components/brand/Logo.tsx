import { useId } from "react";

// Traced from the Algoritm logo; coordinates are the original artwork's pixels.
const AMBER = "#FFBE00";
const TRIANGLE = "191,578 16,924 384,924";
const LAMBDA_CUT = "191,698 213,742 152,868 0,868 0,802 136,802";
const PENCIL_GAP = "281,742 222,866 222,924 228,924 246,905 257,895 271,880 276,870 308,800 312,792 340,742";

/** The triangle-and-pencil mark. The pencil follows the text colour, so it stays visible on dark backgrounds. */
export function LogoMark({ className = "h-7 w-auto" }: { className?: string }) {
  const mask = useId();
  return (
    <svg viewBox="16 578 368 346" className={className} role="img" aria-label="Algoritm">
      <mask id={mask}>
        <polygon points={TRIANGLE} fill="#fff" />
        <polygon points={LAMBDA_CUT} fill="#000" />
        <polygon points={PENCIL_GAP} fill="#000" />
      </mask>
      <polygon points={TRIANGLE} fill={AMBER} mask={`url(#${mask})`} />
      <g fill="currentColor" stroke="currentColor">
        <line x1="290" y1="754" x2="238" y2="864" strokeWidth="13.5" />
        <line x1="303" y1="774" x2="254" y2="876" strokeWidth="13.5" />
        <polygon points="226,898 246,902 226,920" stroke="none" />
      </g>
    </svg>
  );
}

/** Mark plus the ALGORITM wordmark. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-ink ${className}`}>
      <LogoMark className="h-7 w-auto" />
      <span className="text-[17px] font-semibold tracking-[.12em]">ALGORITM</span>
    </span>
  );
}
