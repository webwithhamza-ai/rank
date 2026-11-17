'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, accounts } from '@/db';
import { auth, signOut } from '@/lib/auth';
import { CATEGORIES } from '@/lib/ranking';

const schema = z.object({
  category: z.enum(CATEGORIES),
  tagline: z.string().trim().max(80),
  link: z.string().trim().max(200),
});

export async function updateProfile(formData: FormData): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.accountId) return { error: 'Not signed in' };

  const parsed = schema.safeParse({
    category: formData.get('category'),
    tagline: formData.get('tagline') ?? '',
    link: formData.get('link') ?? '',
  });
  if (!parsed.success) return { error: 'Check the category, tagline and link' };

  const link = parsed.data.link;
  if (link && !/^https?:\/\/\S+$/.test(link)) return { error: 'Link must start with http(s)://' };

  await db()
    .update(accounts)
    .set({
      category: parsed.data.category,
      tagline: parsed.data.tagline || null,
      link: link || null,
    })
    .where(eq(accounts.id, session.user.accountId));

  revalidatePath(`/u/${session.user.handle}`);
  return {};
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}
