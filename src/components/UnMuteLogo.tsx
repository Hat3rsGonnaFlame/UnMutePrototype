export function UnMuteLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
          <path d="M18 11a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V20a1 1 0 1 0 2 0v-3.09A6 6 0 0 0 18 11Z" />
        </svg>
      </span>
      <span className="font-display text-xl font-bold tracking-tight">UnMute.</span>
    </span>
  );
}

export function Waveform({ active = false, bars = 24 }: { active?: boolean; bars?: number }) {
  return (
    <div className="flex h-8 items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-primary/70 ${active ? "wave-bar" : ""}`}
          style={{
            height: `${(20 + Math.abs(Math.sin(i * 1.7)) * 70).toFixed(1)}%`,
            animationDelay: `${(i % 8) * 0.09}s`,
          }}
        />
      ))}
    </div>
  );
}
