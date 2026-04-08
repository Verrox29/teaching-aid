import { PagePlaceholder } from '@/components/page-placeholder';

type PublicJoinPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PublicJoinPage({ params }: PublicJoinPageProps) {
  const { slug } = await params;

  return (
    <PagePlaceholder
      title={`Join Session ${slug}`}
      description="Student-facing flow for joining or selecting a group."
    />
  );
}
