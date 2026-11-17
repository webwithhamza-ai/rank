import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Accent = 'surface' | 'subtle' | 'primary' | 'plain';

const accentClass: Record<Accent, string> = {
  surface: 'bg-surface border border-line',
  subtle: 'bg-subtle border border-line',
  primary: 'bg-[var(--primary-soft)] border border-[var(--primary)]/25',
  plain: 'bg-transparent border border-line',
};

interface CardProps extends HTMLAttributes<HTMLElement> {
  accent?: Accent;
  shadow?: 'none' | 'card' | 'raised';
  as?: ElementType;
  children?: ReactNode;
}

const shadowClass = {
  none: '',
  card: 'shadow-card',
  raised: 'shadow-raised',
};

export function Card({
  accent = 'surface',
  shadow = 'card',
  as: Tag = 'div',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag className={cn('rounded-lg', accentClass[accent], shadowClass[shadow], className)} {...rest}>
      {children}
    </Tag>
  );
}
