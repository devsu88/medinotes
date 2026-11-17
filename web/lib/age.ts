/** How long ago a record is, in words, for the timeline. */
export function ageLabel(iso: string, today: Date = new Date()): string {
  const when = new Date(iso);
  const months = (today.getFullYear() - when.getFullYear()) * 12 + today.getMonth() - when.getMonth();
  if (months < 1) return 'meno di un mese fa';
  if (months < 24) return `${months} mesi fa`;
  return `${Math.floor(months / 12)} anni fa`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
