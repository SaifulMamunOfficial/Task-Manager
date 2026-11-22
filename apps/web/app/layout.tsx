import type { ReactNode } from 'react';
import { Inter, Noto_Sans_Bengali } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import { ToastProvider } from '../components/toast';
import { I18nProvider } from '../lib/i18n';
import Shell from '../components/Shell';
import { THEME_INIT_SCRIPT } from '../lib/theme';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// Bangla glyphs: the browser falls back to this font for Bengali text.
const bengali = Noto_Sans_Bengali({ subsets: ['bengali'], weight: ['400', '500', '600', '700'], variable: '--font-bn', display: 'swap' });

export const metadata = { title: 'Task Manager' };
export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bengali.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>
          <I18nProvider>
            <ToastProvider>
              <Shell>{children}</Shell>
            </ToastProvider>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
