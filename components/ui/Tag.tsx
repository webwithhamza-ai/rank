import { cn } from '@/lib/cn';
import type { Category } from '@/lib/ranking';

export function Tag({
  children,
  className,
  tone = 'subtle',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'subtle' | 'primary' | 'success' | 'outline';
}) {
  const toneClass = {
    subtle: 'bg-subtle text-muted',
    primary: 'bg-[var(--primary-soft)] text-primary',
    success: 'bg-success/10 text-success',
    outline: 'border border-line text-muted',
  }[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-medium leading-5',
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

const categoryDot: Record<Category, string> = {
  KOL: '#E5654A',
  NFT: '#8B5CF6',
  Memecoin: '#2E9BDB',
  Builder: '#12A150',
  Other: '#8A837D',
};

export function CategoryTag({ category, className }: { category: Category; className?: string }) {
  return (
    <Tag className={className}>
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: categoryDot[category] }}
      />
      {category}
    </Tag>
  );
}
