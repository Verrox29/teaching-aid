import { PagePlaceholder } from '@/components/page-placeholder';

type PublicSessionPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PublicSessionPage({ params }: PublicSessionPageProps) {
  const { slug } = await params;

  return (
    <PagePlaceholder
      title={`Public Session ${slug}`}
      description="Student-facing page for viewing groups and session information."
    />
  );
}
