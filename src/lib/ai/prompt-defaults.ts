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
      '{{evaluation_criteria}}',
      '{{question_variation_focus}}',
      '{{session_language}}'
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
      'If the session language is French, write the questions in clear French and address the presenting group directly with "vous".',
      'Do not use indirect wording such as "ce groupe" or long copied fragments from the submission.',
      'Make each regeneration feel fresh by varying which angle is emphasized.',
      '',
      'Teacher context:',
      '- Group: {{group_name}}',
      '- Presentation content: {{presentation_content}}',
      '- Uploaded submission: {{submission_text}}',
      '- Session context: {{session_context}}',
      '- Assignment brief: {{assignment_brief}}',
      '- Evaluation criteria: {{evaluation_criteria}}',
      '- Regeneration focus: {{question_variation_focus}}',
      '- Session language: {{session_language}}',
      '',
      'Return valid JSON only with this exact shape:',
      '{',
      '  "questions": [',
      '    "Question 1",',
      '    "Question 2"',
      '  ]',
      '}',
      '',
      'Return 2 or 3 questions only.'
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
      'Primary goal: reorganize the teacher notes into three feedback sections and one score entry per rubric criterion.',
      '',
      'Grading rules:',
      '- Use one and only one criterion entry for every rubric criterion id.',
      '- Copy the criterion ids exactly as provided in the rubric JSON.',
      '- Keep the order aligned with the rubric.',
      '- Give criterion-specific justifications; do not reuse a generic explanation across all criteria.',
      '- Score conservatively and prefer the lower justified score when evidence is mixed or incomplete.',
      '- Do not flatten every criterion to the same score unless the evidence truly supports that.',
      '- A perfect 20/20 should be exceptional and rare.',
      '- Keep every score within the criterion max score.',
      '',
      'The feedback should reflect:',
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
      'Return valid JSON only with this exact shape:',
      '{',
      '  "criteria": [',
      '    {',
      '      "id": "exact-rubric-criterion-id",',
      '      "score": 0,',
      '      "justification": "criterion-specific explanation"',
      '    }',
      '  ],',
      '  "commentSections": {',
      '    "strengths": "...",',
      '    "areasForDevelopment": "...",',
      '    "overallFeedback": "...",',
      '    "questionsAndComments": "...",',
      '    "gradeBreakdown": "..."',
      '  }',
      '}',
      '',
      'If a section is thin, keep it concise rather than inventing unsupported detail.'
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
