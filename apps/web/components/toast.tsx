'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type T = { id: number; text: string; kind: 'ok' | 'error' };
const Ctx = createContext<{ ok: (m: string) => void; error: (m: string) => void }>({ ok: () => {}, error: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const push = useCallback((text: string, kind: T['kind']) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);
  return (
    <Ctx.Provider value={{ ok: (m) => push(m, 'ok'), error: (m) => push(m, 'error') }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>{t.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
