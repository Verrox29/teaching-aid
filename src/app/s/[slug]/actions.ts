'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db, groupMembers } from '@/db';

import {
  getGroupForSession,
  getGroupMemberCount,
  getSessionBySlug,
  getStudentByEmail,
  getStudentById,
  getStudentMembership
} from './queries';

const identifyStudentSchema = z.object({
  slug: z.string().trim().min(1, 'Missing session slug'),
  schoolEmail: z.string().trim().email('Enter a valid school email')
});

const joinGroupSchema = z.object({
  slug: z.string().trim().min(1, 'Missing session slug'),
  studentId: z.string().uuid('Invalid student id'),
  groupId: z.string().uuid('Invalid group id')
});

function publicSessionPath(slug: string) {
  return `/s/${slug}`;
}

function publicJoinPath(slug: string) {
  return `/s/${slug}/join`;
}

function redirectWithParams(path: string, params: Record<string, string>): never {
  const searchParams = new URLSearchParams(params);
  redirect(`${path}?${searchParams.toString()}`);
}

export async function identifyStudentAction(formData: FormData): Promise<never> {
  const parsed = identifyStudentSchema.safeParse({
    slug: String(formData.get('slug') ?? ''),
    schoolEmail: String(formData.get('schoolEmail') ?? '')
  });

  if (!parsed.success) {
    redirectWithParams(publicJoinPath(String(formData.get('slug') ?? '')), {
      error: 'Enter a valid school email.'
    });
  }

  const session = await getSessionBySlug(parsed.data.slug);
  if (!session) {
    redirectWithParams(publicJoinPath(parsed.data.slug), {
      error: 'Session not found.'
    });
  }

  const normalizedEmail = parsed.data.schoolEmail.toLowerCase();
  const student = await getStudentByEmail(session.id, normalizedEmail);
  if (!student) {
    redirectWithParams(publicJoinPath(parsed.data.slug), {
      error: 'No student matched that email.'
    });
  }

  redirectWithParams(publicJoinPath(parsed.data.slug), {
    studentId: student.id
  });
}

export async function joinGroupAction(formData: FormData): Promise<never> {
  const parsed = joinGroupSchema.safeParse({
    slug: String(formData.get('slug') ?? ''),
    studentId: String(formData.get('studentId') ?? ''),
    groupId: String(formData.get('groupId') ?? '')
  });

  if (!parsed.success) {
    redirectWithParams(publicJoinPath(String(formData.get('slug') ?? '')), {
      error: 'Please choose a valid group.'
    });
  }

  const session = await getSessionBySlug(parsed.data.slug);
  if (!session) {
    redirectWithParams(publicJoinPath(parsed.data.slug), {
      error: 'Session not found.'
    });
  }

  if (session.groupSelectionLocked) {
    redirectWithParams(publicJoinPath(parsed.data.slug), {
      studentId: parsed.data.studentId,
      error: 'Groups are locked for this session.'
    });
  }

  const student = await getStudentById(session.id, parsed.data.studentId);
  if (!student) {
    redirectWithParams(publicJoinPath(parsed.data.slug), {
      error: 'Student not found.'
    });
  }

  const group = await getGroupForSession(session.id, parsed.data.groupId);
  if (!group) {
    redirectWithParams(publicJoinPath(parsed.data.slug), {
      studentId: parsed.data.studentId,
      error: 'Group not found.'
    });
  }

  const currentMembership = await getStudentMembership(session.id, student.id);
  if (currentMembership?.groupId === group.id) {
    redirectWithParams(publicJoinPath(parsed.data.slug), {
      studentId: student.id,
      notice: `You are already in ${group.name}.`
    });
  }

  const memberCount = await getGroupMemberCount(group.id);

  if (memberCount >= group.capacity) {
    redirectWithParams(publicJoinPath(parsed.data.slug), {
      studentId: student.id,
      error: 'That group is already full.'
    });
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(groupMembers)
        .where(
          and(
            eq(groupMembers.sessionId, session.id),
            eq(groupMembers.sessionStudentId, student.id)
          )
        );

      await tx.insert(groupMembers).values({
        sessionId: session.id,
        groupId: group.id,
        sessionStudentId: student.id
      });
    });
  } catch (error) {
    console.error('Failed to save public group selection', error);
    redirectWithParams(publicJoinPath(parsed.data.slug), {
      studentId: student.id,
      error: 'Could not save your group selection. Please try again.'
    });
  }

  revalidatePath(publicSessionPath(parsed.data.slug));
  revalidatePath(publicJoinPath(parsed.data.slug));

  redirectWithParams(publicJoinPath(parsed.data.slug), {
    studentId: student.id,
    notice: `You joined ${group.name}.`
  });
}
