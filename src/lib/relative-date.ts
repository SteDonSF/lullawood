// Warm, bedtime-flavoured relative dates for the story library.
// "Tonight" · "Last night" · "3 nights ago" · "Last Tuesday" · "Mar 4".
export function relativeNight(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startToday.getTime() - startThat.getTime()) / 86_400_000);

  if (days <= 0) return "Tonight";
  if (days === 1) return "Last night";
  if (days < 7) return `${days} nights ago`;
  if (days < 14) return `Last ${d.toLocaleDateString(undefined, { weekday: "long" })}`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(startToday.getFullYear() !== startThat.getFullYear() ? { year: "numeric" } : {}),
  });
}
