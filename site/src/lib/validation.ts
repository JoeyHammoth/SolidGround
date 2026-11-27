/** The API reports which dataset was validated, not the runner's checkout path. */
export function validationTargetLabels(targets: readonly string[]): string[] {
  return targets.map((target) => {
    const parts = target.split(/[\\/]/).filter(Boolean);
    return parts.at(-1) ?? target;
  });
}
