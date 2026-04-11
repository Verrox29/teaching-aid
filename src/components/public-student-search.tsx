'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type PublicStudentSearchProps = {
  sessionSlug: string;
  students: Array<{
    firstName: string;
    id: string;
    lastName: string;
    schoolEmail: string;
  }>;
};

function normalize(value: string) {
  return value.toLowerCase().trim();
}

export function PublicStudentSearch({ sessionSlug, students }: PublicStudentSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const normalizedQuery = normalize(query);

  const matches = normalizedQuery
    ? students.filter((student) => {
        const fullName = `${student.firstName} ${student.lastName}`;
        const reverseName = `${student.lastName} ${student.firstName}`;
        return [
          student.firstName,
          student.lastName,
          fullName,
          reverseName,
          student.schoolEmail
        ].some((value) => normalize(value).includes(normalizedQuery));
      })
    : students;

  function chooseStudent(studentId: string) {
    router.push(`/s/${sessionSlug}/join?studentId=${studentId}`);
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Student name or school email
        <div className="relative">
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveId(null);
            }}
            onFocus={() => {
              if (matches[0]) {
                setActiveId(matches[0].id);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && normalizedQuery) {
                event.preventDefault();
                const selected = matches.find((student) => student.id === activeId) ?? matches[0];
                if (selected) {
                  chooseStudent(selected.id);
                }
              } else if (event.key === 'ArrowDown' && normalizedQuery) {
                event.preventDefault();
                const currentIndex = matches.findIndex((student) => student.id === activeId);
                const nextIndex = currentIndex < matches.length - 1 ? currentIndex + 1 : 0;
                setActiveId(matches[nextIndex]?.id ?? null);
              } else if (event.key === 'ArrowUp' && normalizedQuery) {
                event.preventDefault();
                const currentIndex = matches.findIndex((student) => student.id === activeId);
                const nextIndex = currentIndex > 0 ? currentIndex - 1 : matches.length - 1;
                setActiveId(matches[nextIndex]?.id ?? null);
              }
            }}
            placeholder="Type a name or school email"
            type="text"
            value={query}
          />

          {normalizedQuery ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {matches.length > 0 ? (
                matches.slice(0, 8).map((student) => (
                  <button
                    key={student.id}
                    className={`block w-full border-0 px-3 py-3 text-left text-sm transition ${
                      student.id === activeId
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    onMouseEnter={() => setActiveId(student.id)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      chooseStudent(student.id);
                    }}
                    type="button"
                  >
                    <div className="font-medium">
                      {student.firstName} {student.lastName}
                    </div>
                    <div className="text-xs opacity-80">{student.schoolEmail}</div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-sm text-slate-500">No matching students found.</div>
              )}
            </div>
          ) : null}
        </div>
      </label>

      <p className="text-sm text-slate-500">
        Pick any imported student by name or email, then continue with the existing group flow.
      </p>
    </div>
  );
}
