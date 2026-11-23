'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import PasswordForm from '../../components/PasswordForm';

export default function ChangePassword() {
  const { me } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="card stack" style={{ maxWidth: 420, margin: '8vh auto 0' }}>
      <h1>{me?.mustChangePassword ? t('pw.titleForce') : t('pw.title')}</h1>
      {me?.mustChangePassword && <p className="muted" style={{ margin: 0 }}>{t('pw.temp')}</p>}
      <PasswordForm onCancel={me?.mustChangePassword ? undefined : () => router.back()} />
    </div>
  );
}
