/** Browser-only: reads a hospital funnel workbook into stages and leak reasons. */
export type Stage = { name: string; count: number };
export type Leak = { reason: string; count: number };

export const DEFAULT_STAGES: Stage[] = [
  "Messaged",
  "Registered",
  "Tapped Book",
  "Chose hospital",
  "Found a doctor",
  "Saw open slots",
  "Picked date and time",
  "Booked",
].map((name) => ({ name, count: 0 }));

export async function parseHospitalWorkbook(file: File) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const stages: Stage[] = [];
  const leaks: Leak[] = [];
  const notes: string[] = [];

  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name]!, { header: 1, blankrows: true });
    for (let i = 0; i < rows.length; i++) {
      const r = Array.from(rows[i] ?? [], (c: any) => c).map((c) => (typeof c === "string" ? c.trim() : c));
      const low = r.map((c) => String(c ?? "").toLowerCase());

      if (typeof r[0] === "string" && /days covered/i.test(r[0])) {
        const v = r.find((c, k) => k > 0 && typeof c === "number");
        if (v) notes.push(`Data covers ${v} days.`);
      }

      const stepCol = low.indexOf("step");
      const reachedCol = low.findIndex((c) => c.startsWith("reached"));
      if (!stages.length && stepCol >= 0 && reachedCol >= 0) {
        for (let j = i + 1; j < rows.length; j++) {
          const row = rows[j] ?? [];
          const n = row[stepCol];
          const c = Number(row[reachedCol]);
          if (!n || !Number.isFinite(c)) break;
          if (/rate|%/i.test(String(n))) continue;
          stages.push({ name: String(n).slice(0, 80), count: c });
        }
      }

      const typeCol = low.indexOf("leakage type");
      const lostCol = low.findIndex((c) => c === "did not book");
      const totalCol = low.findIndex((c) => c.startsWith("chats (total)"));
      if (!leaks.length && typeCol >= 0 && (lostCol >= 0 || totalCol >= 0)) {
        const col = lostCol >= 0 ? lostCol : totalCol;
        for (let j = i + 1; j < rows.length; j++) {
          const row = rows[j] ?? [];
          const n = row[typeCol];
          const c = Number(row[col]);
          if (!n || !Number.isFinite(c)) break;
          leaks.push({ reason: String(n).slice(0, 120), count: c });
        }
      }
    }
  }
  return { stages: stages.slice(0, 12), leaks: leaks.slice(0, 20), notes };
}
