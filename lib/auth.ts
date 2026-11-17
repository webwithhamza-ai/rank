import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Twitter from 'next-auth/providers/twitter';
import { eq } from 'drizzle-orm';
import { db, accounts } from '@/db';
import { env, adminXIds } from '@/lib/env';
import { isCategory } from '@/lib/ranking';

declare module 'next-auth' {
  interface Session {
    user: {
      accountId: string;
      xUserId: string;
      handle: string;
      isAdmin: boolean;
      isMock: boolean;
    } & DefaultSession['user'];
  }
}

interface UpsertInput {
  xUserId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  followerCount?: number | null;
  isMock: boolean;
}

/** One identity per X user id. Handles change; the id does not. */
async function upsertAccount(input: UpsertInput) {
  const database = db();
  const existing = await database.query.accounts.findFirst({
    where: eq(accounts.xUserId, input.xUserId),
  });

  if (existing) {
    const [updated] = await database
      .update(accounts)
      .set({
        handle: input.handle,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl ?? existing.avatarUrl,
        avatarColor: input.avatarColor ?? existing.avatarColor,
        followerCount: input.followerCount ?? existing.followerCount,
      })
      .where(eq(accounts.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await database
    .insert(accounts)
    .values({
      xUserId: input.xUserId,
      handle: input.handle,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? null,
      avatarColor: input.avatarColor ?? null,
      followerCount: input.followerCount ?? null,
      isMock: input.isMock,
    })
    .returning();
  return created;
}

function providers() {
  const e = env();
  if (e.AUTH_MODE === 'x') {
    return [
      Twitter({
        clientId: e.AUTH_TWITTER_ID,
        clientSecret: e.AUTH_TWITTER_SECRET,
        userinfo: {
          url: 'https://api.twitter.com/2/users/me',
          params: { 'user.fields': 'profile_image_url,public_metrics,description' },
        },
      }),
    ];
  }

  return [
    Credentials({
      id: 'mock',
      name: 'Mock X login',
      credentials: {
        handle: { label: 'Handle' },
        displayName: { label: 'Display name' },
        avatarColor: { label: 'Avatar colour' },
      },
      async authorize(raw) {
        const handle = String(raw?.handle ?? '')
          .trim()
          .replace(/^@/, '')
          .slice(0, 30);
        if (!/^[A-Za-z0-9_]{1,30}$/.test(handle)) return null;
        const displayName = String(raw?.displayName ?? '').trim().slice(0, 50) || handle;
        const avatarColor = String(raw?.avatarColor ?? '#FFE500');
        const account = await upsertAccount({
          xUserId: `mock:${handle.toLowerCase()}`,
          handle,
          displayName,
          avatarColor,
          isMock: true,
        });
        return {
          id: account.id,
          name: account.displayName,
          email: null,
          xUserId: account.xUserId,
          handle: account.handle,
        } as never;
      },
    }),
  ];
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  trustHost: true,
  secret: env().AUTH_SECRET ?? 'dev-only-insecure-secret-change-me',
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: providers(),
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // Real X sign-in: refresh the stored profile on every login.
      if (account?.provider === 'twitter' && profile) {
        const data = (profile as { data?: Record<string, unknown> }).data ?? profile;
        const xUserId = String((data as Record<string, unknown>).id ?? '');
        const handle = String((data as Record<string, unknown>).username ?? '');
        const displayName = String((data as Record<string, unknown>).name ?? handle);
        const avatarUrl = (data as Record<string, unknown>).profile_image_url as string | undefined;
        const metrics = (data as Record<string, unknown>).public_metrics as
          | { followers_count?: number }
          | undefined;
        if (xUserId && handle) {
          const row = await upsertAccount({
            xUserId,
            handle,
            displayName,
            // X returns a _normal (48px) URL; ask for the bigger one.
            avatarUrl: avatarUrl?.replace('_normal', '_400x400') ?? null,
            followerCount: metrics?.followers_count ?? null,
            isMock: false,
          });
          token.accountId = row.id;
          token.xUserId = row.xUserId;
          token.handle = row.handle;
          token.isMock = false;
        }
      }

      if (user && 'xUserId' in (user as Record<string, unknown>)) {
        const u = user as unknown as { id: string; xUserId: string; handle: string };
        token.accountId = u.id;
        token.xUserId = u.xUserId;
        token.handle = u.handle;
        token.isMock = true;
      }

      return token;
    },
    async session({ session, token }) {
      const xUserId = String(token.xUserId ?? '');
      session.user = {
        ...session.user,
        accountId: String(token.accountId ?? ''),
        xUserId,
        handle: String(token.handle ?? ''),
        isAdmin: Boolean(xUserId) && adminXIds().includes(xUserId),
        isMock: Boolean(token.isMock),
      };
      return session;
    },
  },
}));

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.accountId) return null;
  return session;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}
