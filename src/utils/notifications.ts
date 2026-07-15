/** Parse HOD-tagged notification titles like "[COMPUTER SCIENCE] Internals due". */
export function parseNotificationTitle(rawTitle: string): { title: string; department?: string } {
  const text = (rawTitle || "").trim();
  const match = text.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) return { title: text };
  return {
    department: match[1].trim(),
    title: (match[2] || "").trim() || match[1].trim(),
  };
}

/** Remove trailing HOD signature lines from message body. */
export function cleanNotificationMessage(rawMessage: string): string {
  return (rawMessage || "")
    .replace(/\n*\s*[-–—]\s*HOD,?\s*.+$/i, "")
    .trim();
}

export function formatNotificationAudience(audience: string): string {
  if (audience === "all") return "Everyone";
  if (audience === "students") return "Students";
  if (audience === "teachers") return "Teachers";
  if (audience === "admin") return "Admins";
  return audience;
}
