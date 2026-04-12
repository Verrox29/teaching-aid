export const BRANCHING_AI_PROMPT_KEYS = [
  'generate_challenge_questions',
  'generate_feedback_and_grading',
  'spellcheck_final_feedback_only'
] as const;

export type BranchingAiPromptKey = (typeof BRANCHING_AI_PROMPT_KEYS)[number];

export type BranchingAiPromptDefault = {
  description: string;
  placeholders: string[];
  promptKey: BranchingAiPromptKey;
  template: string;
  title: string;
};

export const BRANCHING_AI_PROMPT_DEFAULTS: Record<
  BranchingAiPromptKey,
  BranchingAiPromptDefault
> = {
  generate_challenge_questions: {
    description:
      'Generate 2–3 concise but demanding oral questions from uploaded student work.',
    placeholders: [
      '{{group_name}}',
      '{{presentation_content}}',
      '{{submission_text}}',
      '{{session_context}}',
      '{{assignment_brief}}',
      '{{evaluation_criteria}}'
    ],
    promptKey: 'generate_challenge_questions',
    template: [
      'You are helping a teacher challenge a student group after they uploaded work or presented it.',
      '',
      'Primary goal: generate 2 to 3 concise but challenging oral questions that test real understanding.',
      '',
      'Focus on:',
      '- the rationale behind the work',
      '- decision logic and assumptions',
      '- how the group would defend its choices',
      '- whether the students understand the method, not just the final result',
      '',
      'Use the uploaded work as the main source of truth.',
      'Avoid trivia, generic comprehension checks, or questions that can be answered from memory alone.',
      '',
      'Teacher context:',
      '- Group: {{group_name}}',
      '- Presentation content: {{presentation_content}}',
      '- Uploaded submission: {{submission_text}}',
      '- Session context: {{session_context}}',
      '- Assignment brief: {{assignment_brief}}',
      '- Evaluation criteria: {{evaluation_criteria}}',
      '',
      'Return teacher-friendly output only.'
    ].join('\n'),
    title: 'Challenge Questions'
  },
  generate_feedback_and_grading: {
    description:
      'Turn teacher comments into structured feedback and strict criteria-based grading.',
    placeholders: [
      '{{teacher_presentation_comments}}',
      '{{teacher_qa_comments}}',
      '{{peer_questions_observed}}',
      '{{evaluation_criteria}}',
      '{{rubric}}',
      '{{group_name}}'
    ],
    promptKey: 'generate_feedback_and_grading',
    template: [
      'You are helping a teacher transform notes into structured evaluation feedback.',
      '',
      'Primary goal: reorganize the teacher notes into three sections:',
      '- Strengths',
      '- Points for development',
      '- General feedback',
      '',
      'Also propose criteria-based grading.',
      'The grading must be strict and severe.',
      'A score of 20/20 should be exceptionally rare and reserved for truly extraordinary performance.',
      '',
      'Make sure the output reflects:',
      '- presentation performance',
      '- Q&A performance',
      '- questions raised by other groups when they appear in the notes',
      '',
      'Use the following context:',
      '- Group: {{group_name}}',
      '- Presentation comments: {{teacher_presentation_comments}}',
      '- Q&A comments: {{teacher_qa_comments}}',
      '- Peer questions observed: {{peer_questions_observed}}',
      '- Evaluation criteria: {{evaluation_criteria}}',
      '- Rubric: {{rubric}}',
      '',
      'Return structured output, not loose prose alone.'
    ].join('\n'),
    title: 'Feedback & Grading'
  },
  spellcheck_final_feedback_only: {
    description:
      'Correct spelling and obvious language mistakes only, without changing the feedback.',
    placeholders: ['{{final_feedback_text}}', '{{criteria_feedback_text}}'],
    promptKey: 'spellcheck_final_feedback_only',
    template: [
      'You are proofreading feedback that has already been reviewed by a teacher.',
      '',
      'Only correct spelling and obvious grammar mistakes.',
      'Do not rewrite meaning, structure, tone, grading intent, criteria, or substance.',
      'Do not summarize, expand, soften, or reorganize the feedback.',
      'Keep the original feedback as intact as possible.',
      '',
      'Text to proofread:',
      '{{final_feedback_text}}',
      '',
      'Criteria feedback context:',
      '{{criteria_feedback_text}}'
    ].join('\n'),
    title: 'Final Spell Check Only'
  }
};
