'use client';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../../lib/auth';

// Navigation lives in the sidebar. This layout only keeps non-admins out (the API refuses them too).
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { me, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready && me && !me.isAdmin) router.replace('/desk');
  }, [ready, me, router]);
  if (!me?.isAdmin) return null;
  return <>{children}</>;
}
