'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearTokens, hasSession, post, saveTokens } from './api';
import type { Me } from './ui';

type AuthCtx = {
  me: Me | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  /** Can this person give tasks to anyone? null while unknown. */
  canGive: boolean | null;
};
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [canGive, setCanGive] = useState<boolean | null>(null);

  const reload = useCallback(async () => {
    if (!hasSession()) {
      setMe(null);
      return;
    }
    try {
      setMe(await api<Me>('/auth/me'));
    } catch {
      clearTokens();
      setMe(null);
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setReady(true));
  }, [reload]);

  // Whether any of the person's positions is allowed to give tasks (drives the New task buttons).
  useEffect(() => {
    if (!me || me.isAdmin || me.mustChangePassword) {
      setCanGive(me ? false : null);
      return;
    }
    api('/settings/delegation')
      .then((rules: { fromPositionId: string }[]) => setCanGive(rules.some((r) => me.positions.some((p) => p.position.id === r.fromPositionId))))
      .catch(() => setCanGive(true));
  }, [me]);

  const login = async (email: string, password: string) => {
    const r = await post('/auth/login', { email, password });
    saveTokens(r);
    setMe(r.user);
  };
  const logout = async () => {
    const rt = localStorage.getItem('rt');
    if (rt) await post('/auth/logout', { refreshToken: rt }).catch(() => {});
    clearTokens();
    setMe(null);
  };

  return <Ctx.Provider value={{ me, ready, login, logout, reload, canGive }}>{children}</Ctx.Provider>;
}
