type PromptVariables = Record<string, string | number | boolean | null | undefined>;

function stringifyPromptValue(value: PromptVariables[string]) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

export function renderPromptTemplate(template: string, variables: PromptVariables) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) =>
    stringifyPromptValue(variables[key])
  );
}
