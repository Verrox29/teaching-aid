'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { createSessionAction } from '@/app/sessions/actions';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="ui-button ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? 'Creating...' : 'Create session'}
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
    title: '',
    language: 'fr',
    instruction_text: '',
    default_group_capacity: '',
    group_count: '',
    admin_access_code: ''
  }
} as const;

export function SessionCreateForm() {
  const [state, formAction] = useActionState(
    createSessionAction,
    initialCreateSessionFormState
  );

  return (
    <form action={formAction} className="ui-card grid gap-6 p-6">
      <div className="grid gap-2">
        <label className="text-sm font-medium text-[color:var(--app-fg)]" htmlFor="title">
          Title
        </label>
        <input
          className="ui-input"
          defaultValue={state.values.title}
          id="title"
          name="title"
          type="text"
        />
        <FieldError errors={state.errors.title} />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-[color:var(--app-fg)]" htmlFor="language">
          Language
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

      <div className="grid gap-2">
        <label className="text-sm font-medium text-[color:var(--app-fg)]" htmlFor="instruction_text">
          Instruction Text
        </label>
        <textarea
          className="ui-textarea"
          defaultValue={state.values.instruction_text}
          id="instruction_text"
          name="instruction_text"
        />
        <FieldError errors={state.errors.instruction_text} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-[color:var(--app-fg)]" htmlFor="default_group_capacity">
            Default Group Capacity
          </label>
          <input
            className="ui-input"
            defaultValue={state.values.default_group_capacity}
            id="default_group_capacity"
            min="1"
            name="default_group_capacity"
            step="1"
            type="number"
          />
          <FieldError errors={state.errors.default_group_capacity} />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-[color:var(--app-fg)]" htmlFor="group_count">
            Group Count
          </label>
          <input
            className="ui-input"
            defaultValue={state.values.group_count}
            id="group_count"
            min="1"
            name="group_count"
            step="1"
            type="number"
          />
          <FieldError errors={state.errors.group_count} />
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-[color:var(--app-fg)]" htmlFor="admin_access_code">
          Admin Access Code
        </label>
        <input
          className="ui-input"
          defaultValue={state.values.admin_access_code}
          id="admin_access_code"
          name="admin_access_code"
          type="password"
        />
        <FieldError errors={state.errors.admin_access_code} />
      </div>

      {state.message ? <p className="text-sm text-[color:var(--app-danger)]">{state.message}</p> : null}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
