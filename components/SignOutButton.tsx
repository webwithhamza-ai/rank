'use client';

import { signOutAction } from '@/app/u/[handle]/actions';
import { Button } from '@/components/ui/Button';

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  );
}
