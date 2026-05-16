'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsRoot() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings/organization');
  }, [router]);
  return null;
}
