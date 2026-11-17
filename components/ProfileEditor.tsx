'use client';

import { useState, useTransition } from 'react';
import { updateProfile } from '@/app/u/[handle]/actions';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Hint, Input, Label, Select } from '@/components/ui/Input';
import { CATEGORIES, type Category } from '@/lib/ranking';

export function ProfileEditor({
  category,
  tagline,
  link,
}: {
  category: Category;
  tagline: string;
  link: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [taglineValue, setTaglineValue] = useState(tagline);
  const [pending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateProfile(formData);
      setMessage(result.error ?? 'Saved.');
    });
  };

  return (
    <Card className="p-5">
      <form action={onSubmit} className="grid gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" defaultValue={category}>
            {CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            name="tagline"
            maxLength={80}
            value={taglineValue}
            onChange={(event) => setTaglineValue(event.target.value)}
          />
          <Hint>{80 - taglineValue.length} characters left</Hint>
        </div>

        <div>
          <Label htmlFor="link">Link</Label>
          <Input id="link" name="link" type="url" defaultValue={link} placeholder="https://" />
        </div>

        <div className="flex flex-wrap items-center gap-3 md:col-span-3">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save listing'}
          </Button>
          {message ? <span className="text-sm text-muted">{message}</span> : null}
        </div>
      </form>
    </Card>
  );
}
