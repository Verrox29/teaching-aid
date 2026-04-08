import { PagePlaceholder } from '@/components/page-placeholder';

type SessionStudentsPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionStudentsPage({
  params
}: SessionStudentsPageProps) {
  const { sessionId } = await params;

  return (
    <PagePlaceholder
      title={`Session ${sessionId} · Students`}
      description="Import students and review roster details."
    />
  );
}
