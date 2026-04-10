import Link from 'next/link';

import { AdminShell } from '@/components/admin-shell';
import { SessionCreateForm } from '@/components/session-create-form';

export default function NewSessionPage() {
  return (
    <AdminShell
      actions={
        <Link className="ui-button ui-button-ghost" href="/sessions">
          Back to sessions
        </Link>
      }
      description="Set up a peer-to-peer session and generate its admin access."
      title="Create session"
    >
      <div className="max-w-3xl">
        <SessionCreateForm />
      </div>
    </AdminShell>
  );
}
