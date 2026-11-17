'use server';

import { revalidatePath } from 'next/cache';
import { eq, not } from 'drizzle-orm';
import { z } from 'zod';
import { db, accounts, reports } from '@/db';
import { requireAdmin } from '@/lib/auth';
import { markRefunded } from '@/lib/credit';

export async function toggleHidden(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) throw new Error('Not authorised');
  const accountId = z.string().uuid().parse(formData.get('accountId'));
  await db()
    .update(accounts)
    .set({ hidden: not(accounts.hidden) })
    .where(eq(accounts.id, accountId));
  revalidatePath('/admin');
}

export async function refundPayment(formData: FormData): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: 'Not authorised' };

  const parsed = z
    .object({
      paymentId: z.string().uuid(),
      refundTxHash: z.string().trim().min(4).max(120),
    })
    .safeParse({
      paymentId: formData.get('paymentId'),
      refundTxHash: formData.get('refundTxHash'),
    });
  if (!parsed.success) return { error: 'Enter the refund transaction hash' };

  await markRefunded(parsed.data.paymentId, parsed.data.refundTxHash);
  revalidatePath('/admin');
  return {};
}

export async function resolveReport(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) throw new Error('Not authorised');
  const reportId = z.string().uuid().parse(formData.get('reportId'));
  await db().update(reports).set({ resolved: true }).where(eq(reports.id, reportId));
  revalidatePath('/admin');
}
