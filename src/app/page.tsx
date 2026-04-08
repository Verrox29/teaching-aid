import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-8">
      <h1 className="text-3xl font-semibold">teaching-aid</h1>
      <p className="text-slate-700">
        Lightweight self-hosted app for peer-to-peer learning sessions.
      </p>
      <Link className="text-blue-600 hover:underline" href="/sessions">
        Go to sessions
      </Link>
    </main>
  );
}
