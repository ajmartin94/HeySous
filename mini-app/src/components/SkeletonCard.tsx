interface SkeletonCardProps {
  lines?: number;
}

const LINE_WIDTHS = ['100%', '75%', '60%', '90%', '50%'];

export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  return (
    <div
      style={{
        background: 'var(--tgui--skeleton, #e0e0e0)',
        borderRadius: 'var(--hs-border-radius)',
        padding: 'var(--hs-spacing-card)',
        animation: 'hs-skeleton-pulse 1.5s ease-in-out infinite',
      }}
    >
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          style={{
            height: 14,
            width: LINE_WIDTHS[i % LINE_WIDTHS.length],
            background: 'rgba(0, 0, 0, 0.08)',
            borderRadius: 6,
            marginBottom: i < lines - 1 ? 10 : 0,
          }}
        />
      ))}
    </div>
  );
}
