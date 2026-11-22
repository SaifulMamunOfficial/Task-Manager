import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearTokens, currentRefreshToken, loadTokens, loginRequest, post, saveTokens, setSessionLostHandler } from './api';
import { unregisterPush } from './push';
import type { Me } from './types';

type AuthCtx = {
  me: Me | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  offline: boolean;
  /** Can this person give tasks to anyone? null while unknown. */
  canGive: boolean | null;
};
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [canGive, setCanGive] = useState<boolean | null>(null);
  /** The server could not be reached (as opposed to the session being rejected). */
  const [offline, setOffline] = useState(false);

  const reload = useCallback(async () => {
    try {
      setMe(await api<Me>('/auth/me'));
      setOffline(false);
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 403) {
        await clearTokens();
        setMe(null);
        setOffline(false);
      } else {
        // No connection or a server hiccup: keep the saved sign-in and let the person retry.
        setOffline(true);
      }
    }
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => setMe(null));
    (async () => {
      if (await loadTokens()) await reload();
      setReady(true);
    })();
  }, [reload]);

  useEffect(() => {
    if (!me || me.isAdmin || me.mustChangePassword) {
      setCanGive(me ? false : null);
      return;
    }
    api<{ fromPositionId: string }[]>('/settings/delegation')
      .then((rules) => setCanGive(rules.some((r) => me.positions.some((p) => p.position.id === r.fromPositionId))))
      .catch(() => setCanGive(true));
  }, [me]);

  const login = async (email: string, password: string) => {
    const r = await loginRequest(email, password);
    await saveTokens(r);
    setMe(r.user);
  };
  const logout = async () => {
    await unregisterPush().catch(() => {});
    const rt = currentRefreshToken();
    if (rt) await post('/auth/logout', { refreshToken: rt }).catch(() => {});
    await clearTokens();
    setMe(null);
  };

  return <Ctx.Provider value={{ me, ready, login, logout, reload, canGive, offline }}>{children}</Ctx.Provider>;
}
