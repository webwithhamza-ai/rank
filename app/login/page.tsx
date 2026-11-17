import type { Metadata } from 'next';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth';
import { env, isDbConfigured } from '@/lib/env';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Hint } from '@/components/ui/Input';
import { SetupNotice } from '@/components/SetupNotice';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sign in' };

const MOCK_COLORS = ['#E5654A', '#8B5CF6', '#2E9BDB', '#12A150', '#E5A00D'];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isDbConfigured()) return <SetupNotice />;

  const { error } = await searchParams;
  const mockAuth = env().AUTH_MODE === 'mock';

  async function signInWithX() {
    'use server';
    await signIn('twitter', { redirectTo: '/claim' });
  }

  async function signInMock(formData: FormData) {
    'use server';
    try {
      await signIn('mock', {
        handle: String(formData.get('handle') ?? ''),
        displayName: String(formData.get('displayName') ?? ''),
        avatarColor: String(formData.get('avatarColor') ?? '#E5654A'),
        redirectTo: '/claim',
      });
    } catch (caught) {
      if (caught instanceof AuthError) redirect('/login?error=invalid');
      throw caught;
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="text-center text-2xl font-extrabold tracking-tight">Sign in</h1>

      {error ? (
        <p className="mt-4 rounded-md bg-[var(--primary-soft)] p-3 text-center text-sm text-primary">
          That handle did not work. Use letters, numbers and underscores only.
        </p>
      ) : null}

      {mockAuth ? (
        <Card className="mt-6 p-6">
          <h2 className="text-base font-semibold">Mock X login</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            No X app needed. This creates a session exactly like the real login does, and the
            account is marked with a DEV badge.
          </p>

          <form action={signInMock} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="handle">Handle</Label>
              <Input id="handle" name="handle" required placeholder="testuser1" autoComplete="off" />
              <Hint>Without the @. Letters, numbers and underscores.</Hint>
            </div>

            <div>
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" name="displayName" placeholder="Test User" autoComplete="off" />
            </div>

            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium">Avatar colour</legend>
              <div className="flex gap-2">
                {MOCK_COLORS.map((color, index) => (
                  <label key={color} className="cursor-pointer">
                    <input
                      type="radio"
                      name="avatarColor"
                      value={color}
                      defaultChecked={index === 0}
                      className="peer sr-only"
                    />
                    <span
                      style={{ backgroundColor: color }}
                      className="block h-9 w-9 rounded-md ring-offset-2 ring-offset-[var(--surface)] peer-checked:ring-2 peer-checked:ring-fg peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                    />
                    <span className="sr-only">{color}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Button type="submit" size="lg" className="w-full">
              Create mock session
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="mt-6 p-6 text-center">
          <h2 className="text-base font-semibold">Continue with X</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            We read your handle, display name, avatar and follower count. We never post, never read
            your DMs, and never ask you to connect a wallet.
          </p>
          <form action={signInWithX} className="mt-5">
            <Button type="submit" size="lg" className="w-full">
              Continue with X
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
