import { redirect } from 'next/navigation';

export default function Home() {
  const defaultSlug = process.env.NEXT_PUBLIC_ACADEMY_SLUG || 'hokma';
  redirect(`/${defaultSlug}/login`);
}
