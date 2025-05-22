import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/config');
  return null; // Or a loading spinner, but redirect is fast
}
