import { useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  className,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "soft";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles = {
    primary:
      "bg-gradient-to-r from-violet-500 to-cyan-400 text-slate-950 hover:brightness-110 shadow-lg shadow-violet-500/25",
    soft: "bg-white/10 text-white hover:bg-white/20 border border-white/10",
    ghost: "text-slate-300 hover:text-white hover:bg-white/5",
    danger: "bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 border border-rose-400/30",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-white/10", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 transition-[width] duration-200"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="soft"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          },
          () => undefined,
        );
      }}
    >
      {copied ? "✓ Copied" : `⧉ ${label}`}
    </Button>
  );
}

export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "rose" }) {
  const tones = {
    slate: "bg-white/10 text-slate-200",
    green: "bg-emerald-400/15 text-emerald-200",
    amber: "bg-amber-400/15 text-amber-200",
    rose: "bg-rose-400/15 text-rose-200",
  }[tone];
  return <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", tones)}>{children}</span>;
}

export function Code({ children }: { children: string }) {
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-[13px] leading-relaxed text-cyan-100">
        <code>{children}</code>
      </pre>
      <div className="absolute top-2 right-2 opacity-0 transition group-hover:opacity-100">
        <CopyButton text={children} />
      </div>
    </div>
  );
}
