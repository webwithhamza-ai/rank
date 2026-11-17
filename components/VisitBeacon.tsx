'use client';

import { useEffect } from 'react';

/** Counts one unique visitor per salted IP per UTC day. No cookies, no IPs stored. */
export function VisitBeacon() {
  useEffect(() => {
    void fetch('/api/visit', { method: 'POST', keepalive: true }).catch(() => {});
  }, []);
  return null;
}
