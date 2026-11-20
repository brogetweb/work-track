'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewReportPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/daily-reports?compose=1');
  }, [router]);
  return null;
}
