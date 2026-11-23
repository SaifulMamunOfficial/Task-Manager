'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export type Unit = { id: string; name: string; nameBn?: string | null; type: 'HEAD_OFFICE' | 'UNIT'; parentId: string | null; isActive: boolean };
export type Pos = { id: string; title: string; titleBn?: string | null; level: number };
export type Secretariat = { id: string; name: string; nameBn?: string | null; secretaryUserId: string | null; unitId: string };
export type AdminUser = {
  id: string;
  name: string;
  nameBn?: string | null;
  email: string;
  phone: string | null;
  isActive: boolean;
  isAdmin: boolean;
  language?: string;
  positions: { id: string; isPrimary: boolean; reportsToUserId: string | null; secretariatId: string | null; unit: { id: string; name: string; nameBn?: string | null }; secretariat?: { id: string; name: string; nameBn?: string | null } | null; position: Pos }[];
};

/** Everything the admin screens need, loaded together and refreshable. */
export function useOrgData() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [secretariats, setSecretariats] = useState<Secretariat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [u, p, us, tree] = await Promise.all([api('/units'), api('/positions'), api('/users'), api('/org/tree')]);
      setUnits(u);
      setPositions(p);
      setUsers(us);
      setSecretariats(tree.flatMap((t: any) => t.secretariats.map((s: any) => ({ ...s, unitId: t.id }))));
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { units, positions, users, secretariats, loading, error, reload };
}
