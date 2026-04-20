'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { createSessionAction } from '@/app/sessions/actions';
import { AppPendingFormBridge } from '@/components/app-interaction-feedback';
import { useUiLanguage } from '@/components/ui-language-toggle';
import { getUiText } from '@/lib/ui-language';

function SubmitButton({ pendingLabel, readyLabel }: { pendingLabel: string; readyLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="ui-button ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : readyLabel}
    </button>
  );
}

type FieldErrorProps = {
  errors?: string[];
};

function FieldError({ errors }: FieldErrorProps) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-sm text-[color:var(--app-danger)]">{errors[0]}</p>;
}

const initialCreateSessionFormState = {
  errors: {},
  values: {
    subject: '',
    language: 'fr',
    instruction_text: '',
    className: '',
    season: 'Fall',
    sessionDate: ''
  }
} as const;

export function SessionCreateForm() {
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage);
  const [state, formAction] = useActionState(
    createSessionAction,
    initialCreateSessionFormState
  );

  return (
    <form action={formAction} className="ui-card grid gap-6 p-6">
      <AppPendingFormBridge />
      <div className="grid gap-2">
        <label className="text-sm font-medium text-[color:var(--app-fg)]" htmlFor="subject">
          {t.sessionAdmin.subject}
        </label>
        <input
          className="ui-input"
          defaultValue={state.values.subject}
          id="subject"
          name="subject"
          type="text"
        />
        <FieldError errors={state.errors.subject} />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-[color:var(--app-fg)]" htmlFor="language">
          {t.shared.language}
        </label>
        <select
          className="ui-select"
          defaultValue={state.values.language}
          id="language"
          name="language"
        >
          <option value="fr">fr</option>
          <option value="en">en</option>
        </select>
        <FieldError errors={state.errors.language} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-[color:var(--app-fg)]" htmlFor="className">
            {t.sessionAdmin.class}
          </label>
          <input
            className="ui-input"
            defaultValue={state.values.className}
            id="className"
            name="className"
            type="text"
          />
          <FieldError errors={state.errors.className} />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-[color:var(--app-fg)]" htmlFor="season">
            {t.sessionAdmin.intake}
          </label>
          <select className="ui-select" defaultValue={state.values.season || 'Fall'} id="season" name="season">
            <option value="Fall">Fall</option>
            <option value="Spring">Spring</option>
          </select>
          <FieldError errors={state.errors.season} />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label className="text-sm font-medium text-[color:var(--app-fg)]" htmlFor="sessionDate">
            {t.sessionAdmin.presentationDate}
          </label>
          <input
            className="ui-input"
            defaultValue={state.values.sessionDate}
            id="sessionDate"
            name="sessionDate"
            type="date"
          />
          <FieldError errors={state.errors.sessionDate} />
        </div>
      </div>

      {state.message ? <p className="text-sm text-[color:var(--app-danger)]">{state.message}</p> : null}

      <div className="flex justify-end">
        <SubmitButton pendingLabel={t.shared.creatingSession} readyLabel={t.shared.createSession} />
      </div>
    </form>
  );
}
