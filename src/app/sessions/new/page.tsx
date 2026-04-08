import Link from 'next/link';

import { SessionCreateForm } from '@/components/session-create-form';

export default function NewSessionPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Create Session
          </h1>
          <p className="text-sm text-slate-600">
            Set up a peer-to-peer session and generate its admin access.
          </p>
        </div>
        <Link
          className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
          href="/sessions"
        >
          Back to sessions
        </Link>
      </div>

      <SessionCreateForm />
    </main>
  );
}
