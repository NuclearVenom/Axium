export function renderValidationFeedback(issues: string[]): string {
  return `Your previous response was invalid and cannot be used. Fix ALL of the following problems and respond again with the complete, corrected JSON object (the full shape again — not a diff, not just the fixed parts):

${issues.map((issue) => `- ${issue}`).join("\n")}`;
}
