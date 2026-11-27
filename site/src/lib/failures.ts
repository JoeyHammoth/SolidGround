export interface ControlFailureGroup {
  subject: string;
  details: string[];
}

/**
 * Control failures arrive as `control-id: detail`. Grouping by the prefix keeps
 * a repeated fixture id from appearing on every line while preserving the order
 * the harness reported.
 */
export function groupControlFailures(failures: readonly string[]): ControlFailureGroup[] {
  const groups = new Map<string, string[]>();
  for (const failure of failures) {
    const separator = failure.indexOf(":");
    const subject = separator === -1 ? "control" : failure.slice(0, separator).trim();
    const detail = separator === -1 ? failure : failure.slice(separator + 1).trim();
    groups.set(subject, [...(groups.get(subject) ?? []), detail]);
  }
  return [...groups].map(([subject, details]) => ({ subject, details }));
}
