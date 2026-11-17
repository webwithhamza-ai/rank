import { cn } from '@/lib/cn';

interface AvatarProps {
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({
  handle,
  displayName,
  avatarUrl,
  avatarColor,
  size = 44,
  className,
}: AvatarProps) {
  const style = { width: size, height: size };

  if (avatarUrl) {
    return (
      // Avatars come from X's CDN at unpredictable sizes; a plain img keeps the
      // square crop simple and avoids the optimizer round-trip for tiny images.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={`${displayName} (@${handle}) profile picture`}
        style={style}
        className={cn('shrink-0 rounded-md border border-line object-cover', className)}
      />
    );
  }

  const initial = (displayName || handle || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      style={{ ...style, backgroundColor: avatarColor ?? '#E5654A' }}
      role="img"
      aria-label={`${displayName} (@${handle}) avatar`}
      className={cn(
        'grid shrink-0 place-items-center rounded-md font-semibold text-white',
        className,
      )}
    >
      <span style={{ fontSize: size * 0.4 }}>{initial}</span>
    </div>
  );
}
