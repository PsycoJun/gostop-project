'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/lobby');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return <div>Loading...</div>; // Or a proper loading spinner
}