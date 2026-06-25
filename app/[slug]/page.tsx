import { redirect } from 'next/navigation';

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  // Next.js 버전에 따라 params가 Promise일 수도 있으므로 분기 처리
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug;

  redirect(`/${normalizedSlug}/login`);
}
