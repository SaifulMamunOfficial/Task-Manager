'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../lib/auth';

export default function Home() {
  const { me, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready && me) router.replace(me.isAdmin ? '/admin' : '/desk');
  }, [ready, me, router]);
  return null;
}
