import { PagePlaceholder } from '@/components/page-placeholder';

type SessionEvaluationPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionEvaluationPage({
  params
}: SessionEvaluationPageProps) {
  const { sessionId } = await params;

  return (
    <PagePlaceholder
      title={`Session ${sessionId} · Evaluation`}
      description="Run peer evaluation and review responses."
    />
  );
}
