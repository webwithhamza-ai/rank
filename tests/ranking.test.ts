import { describe, expect, it } from 'vitest';
import {
  MIN_PAYMENT_CENTS,
  compareEntries,
  costToOvertakeCents,
  costToReachRankCents,
  findRank,
  isListable,
  msUntilUtcReset,
  projectedRank,
  rankEntries,
  rankEntriesInCategory,
  rankTargets,
  roundUpToDollar,
  utcDayStart,
  type Category,
  type RankableEntry,
} from '@/lib/ranking';

const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);
const minute = 60_000;

function entry(
  id: string,
  dollars: number,
  minutesAfterT0 = 0,
  category: Category = 'KOL',
  hidden = false,
): RankableEntry {
  return {
    id,
    scoreCents: Math.round(dollars * 100),
    scoreReachedAt: T0 + minutesAfterT0 * minute,
    category,
    hidden,
  };
}

describe('sorting and ranking', () => {
  it('sorts by score descending', () => {
    const ranked = rankEntries([entry('a', 10), entry('b', 50), entry('c', 30)]);
    expect(ranked.map((r) => r.entry.id)).toEqual(['b', 'c', 'a']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('breaks ties in favour of whoever reached the score first', () => {
    const earlier = entry('early', 100, 0);
    const later = entry('late', 100, 30);
    expect(compareEntries(earlier, later)).toBeLessThan(0);
    expect(rankEntries([later, earlier]).map((r) => r.entry.id)).toEqual(['early', 'late']);
  });

  it('leaves out hidden listings and anyone under the minimum', () => {
    expect(isListable(entry('a', 0.5))).toBe(false);
    expect(isListable(entry('b', 1))).toBe(true);
    expect(isListable(entry('c', 100, 0, 'KOL', true))).toBe(false);

    const ranked = rankEntries([entry('paid', 5), entry('dust', 0.5), entry('banned', 900, 0, 'KOL', true)]);
    expect(ranked.map((r) => r.entry.id)).toEqual(['paid']);
  });

  it('recomputes ranks inside a category filter', () => {
    const entries = [
      entry('kol-big', 500, 0, 'KOL'),
      entry('nft-mid', 300, 0, 'NFT'),
      entry('kol-small', 100, 0, 'KOL'),
      entry('meme', 50, 0, 'Memecoin'),
    ];

    expect(rankEntriesInCategory(entries, 'ALL').map((r) => r.entry.id)).toEqual([
      'kol-big',
      'nft-mid',
      'kol-small',
      'meme',
    ]);

    const kol = rankEntriesInCategory(entries, 'KOL');
    expect(kol.map((r) => [r.entry.id, r.rank])).toEqual([
      ['kol-big', 1],
      ['kol-small', 2],
    ]);
  });
});

describe('the examples from the spec', () => {
  it('#1 has $100, a new account pays $101 and takes #1', () => {
    const board = [entry('leader', 100, 0)];
    expect(projectedRank(board, 'newcomer', 101 * 100, T0 + 60 * minute)).toBe(1);
  });

  it('#1 has $100, a new account pays $99 and lands directly below everyone on $99 or more', () => {
    const board = [entry('leader', 100, 0), entry('second', 99, 5), entry('third', 40, 5)];
    // Ranks below both $100 and the existing $99, above the $40 account.
    expect(projectedRank(board, 'newcomer', 99 * 100, T0 + 60 * minute)).toBe(3);
  });

  it('an account at #10 on $90 pays $11 more and takes #1 from a $100 leader', () => {
    const board: RankableEntry[] = [entry('leader', 100, 0)];
    for (let i = 0; i < 8; i += 1) board.push(entry(`mid-${i}`, 99 - i, 1));
    board.push(entry('climber', 90, 2));

    expect(findRank(rankEntries(board), 'climber')).toBe(10);

    const climberTotal = 90 * 100;
    expect(costToReachRankCents(board, 'climber', 1, climberTotal)).toBe(11 * 100);

    const newTotal = climberTotal + 11 * 100;
    expect(newTotal).toBe(101 * 100);
    expect(projectedRank(board, 'climber', newTotal, T0 + 90 * minute)).toBe(1);
  });
});

describe('cost calculations', () => {
  it('rounds up to whole dollars and never quotes less than the minimum', () => {
    expect(roundUpToDollar(1)).toBe(100);
    expect(roundUpToDollar(10_001)).toBe(10_100);
    expect(costToOvertakeCents(100 * 100, 0)).toBe(101 * 100);
    expect(costToOvertakeCents(100 * 100, 90 * 100)).toBe(11 * 100);
    // Already ahead: the $1 floor still applies.
    expect(costToOvertakeCents(10 * 100, 50 * 100)).toBe(MIN_PAYMENT_CENTS);
  });

  it('quotes the price of each headline rank', () => {
    const board = [
      entry('a', 500, 0),
      entry('b', 300, 0),
      entry('c', 200, 0),
      ...Array.from({ length: 9 }, (_, i) => entry(`x${i}`, 100 - i, 0)),
    ];

    const targets = rankTargets(board, 'me', 0);
    expect(targets.takeFirst).toBe(501 * 100);
    expect(targets.takeThird).toBe(201 * 100);
    // Tenth place on this board is $94, so $95 gets you in.
    expect(targets.enterTopTen).toBe(95 * 100);
  });

  it('charges only the minimum when the target rank does not exist yet', () => {
    expect(costToReachRankCents([entry('a', 10)], 'me', 10, 0)).toBe(MIN_PAYMENT_CENTS);
  });

  it('ignores your own entry when pricing a rank', () => {
    const board = [entry('leader', 100, 0), entry('me', 80, 1)];
    // Passing the leader, not passing yourself.
    expect(costToReachRankCents(board, 'me', 1, 80 * 100)).toBe(21 * 100);
  });
});

describe('projected rank', () => {
  it('puts a mover below everyone who was already on that score', () => {
    const board = [entry('incumbent', 50, 0), entry('me', 10, 1)];
    expect(projectedRank(board, 'me', 50 * 100, T0 + 10 * minute)).toBe(2);
    expect(projectedRank(board, 'me', 50 * 100 + 1, T0 + 10 * minute)).toBe(1);
  });

  it('adds an unlisted account to the bottom when the amount is small', () => {
    const board = [entry('a', 50, 0), entry('b', 20, 0)];
    expect(projectedRank(board, 'new', 1 * 100, T0)).toBe(3);
  });
});

describe('the UTC day', () => {
  it('starts the day at midnight UTC', () => {
    const at = new Date(Date.UTC(2026, 4, 17, 23, 59, 59));
    expect(utcDayStart(at).toISOString()).toBe('2026-05-17T00:00:00.000Z');
  });

  it('counts down to the next midnight UTC', () => {
    const at = new Date(Date.UTC(2026, 4, 17, 23, 0, 0));
    expect(msUntilUtcReset(at)).toBe(60 * 60 * 1000);
  });
});
