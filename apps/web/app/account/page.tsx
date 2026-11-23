import { redirect } from 'next/navigation';

export default function Account() {
  redirect('/profile?tab=notifications');
}
