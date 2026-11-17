import type { Category } from '@/lib/ranking';

/** The wire shape shared by the server pages and the polling client. */
export interface BoardRow {
  rank: number;
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  category: Category;
  tagline: string | null;
  link: string | null;
  scoreCents: number;
  clicks: number;
  isMock: boolean;
}

export const BOARD_KINDS = ['alltime', 'today'] as const;
export type BoardKindDto = (typeof BOARD_KINDS)[number];
