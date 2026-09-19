import { TimetableEntry, SchoolClass, Staff, Subject, SchoolTimings } from "../types";
import { PDFTimetableExporter } from "./pdfExporter";

export class TimetableExporter {
  static async exportClassPDF(
    classId: number,
    entries: TimetableEntry[],
    classes: SchoolClass[],
    staffList: Staff[],
    subjects: Subject[],
    timings: SchoolTimings
  ): Promise<void> {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return;
    await PDFTimetableExporter.exportClassToPDF(cls, entries, staffList, subjects, timings);
  }

  static async exportStaffPDF(
    staffId: number,
    entries: TimetableEntry[],
    classes: SchoolClass[],
    staffList: Staff[],
    subjects: Subject[],
    timings: SchoolTimings
  ): Promise<void> {
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return;
    await PDFTimetableExporter.exportStaffToPDF(staff, entries, classes, subjects, timings);
  }

  static async exportAllClassesPDF(
    classes: SchoolClass[],
    entries: TimetableEntry[],
    staffList: Staff[],
    subjects: Subject[],
    timings: SchoolTimings,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    await PDFTimetableExporter.exportAllClassesToPDF(
      classes,
      entries,
      staffList,
      subjects,
      timings,
      onProgress
    );
  }

  static async exportAllStaffPDF(
    staffList: Staff[],
    entries: TimetableEntry[],
    classes: SchoolClass[],
    subjects: Subject[],
    timings: SchoolTimings,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    await PDFTimetableExporter.exportAllStaffToPDF(
      staffList,
      entries,
      classes,
      subjects,
      timings,
      onProgress
    );
  }
  static exportClassCSV(
    classId: number,
    entries: TimetableEntry[],
    classes: SchoolClass[],
    staffList: Staff[],
    subjects: Subject[],
    timings: SchoolTimings
  ): void {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return;

    const classMap = new Map(classes.map((c) => [c.id, c]));
    const staffMap = new Map(staffList.map((s) => [s.id, s]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    const activeDays = timings.active_days;
    const header = ["Period", "Time", ...activeDays].join(",");

    const rows: string[] = [header];

    for (let p = 1; p <= timings.total_periods; p++) {
      let timeLabel = `Period ${p}`;
      if (p === 3) timeLabel = "Break 1 (10:50)";
      else if (p === 5) timeLabel = "Lunch (12:20)";
      else if (p === 7) timeLabel = "Break 2 (14:50)";

      const row = [p.toString(), `"${timeLabel}"`];

      for (const day of activeDays) {
        if (p === 3) {
          row.push('"Morning Break"');
          continue;
        }
        if (p === 5) {
          row.push('"Lunch Break"');
          continue;
        }
        if (p === 7) {
          row.push('"Afternoon Break"');
          continue;
        }

        const entry = entries.find((e) => e.class_id === classId && e.day === day && e.period === p);
        if (entry) {
          const sub = subjectMap.get(entry.subject_id)?.name || "Subject";
          const st = staffMap.get(entry.staff_id)?.name || "Staff";
          row.push(`"${sub} (${st})"`);
        } else {
          row.push('"Free"');
        }
      }
      rows.push(row.join(","));
    }

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(rows.join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `timetable_class_${cls.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static exportStaffCSV(
    staffId: number,
    entries: TimetableEntry[],
    classes: SchoolClass[],
    staffList: Staff[],
    subjects: Subject[],
    timings: SchoolTimings
  ): void {
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return;

    const classMap = new Map(classes.map((c) => [c.id, c]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    const activeDays = timings.active_days;
    const header = ["Period", "Time", ...activeDays].join(",");
    const rows: string[] = [header];

    for (let p = 1; p <= timings.total_periods; p++) {
      let timeLabel = `Period ${p}`;
      if (p === 3) timeLabel = "Break 1 (10:50)";
      else if (p === 5) timeLabel = "Lunch (12:20)";
      else if (p === 7) timeLabel = "Break 2 (14:50)";

      const row = [p.toString(), `"${timeLabel}"`];

      for (const day of activeDays) {
        if (p === 3) {
          row.push('"Morning Break"');
          continue;
        }
        if (p === 5) {
          row.push('"Lunch Break"');
          continue;
        }
        if (p === 7) {
          row.push('"Afternoon Break"');
          continue;
        }

        const entry = entries.find((e) => e.staff_id === staffId && e.day === day && e.period === p);
        if (entry) {
          const cls = classMap.get(entry.class_id)?.name || "Class";
          const sub = subjectMap.get(entry.subject_id)?.name || "Subject";
          row.push(`"${cls}: ${sub}"`);
        } else {
          row.push('"FREE"');
        }
      }
      rows.push(row.join(","));
    }

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(rows.join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `timetable_staff_${staff.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static printSchedule(title: string, elementId: string): void {
    const el = document.getElementById(elementId);
    if (!el) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
            h1 { font-size: 22px; margin-bottom: 8px; }
            p { font-size: 14px; color: #64748b; margin-top: 0; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 13px; }
            th { background-color: #f1f5f9; font-weight: 600; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 11px; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p>Generated by School Timetable Management System</p>
          ${el.innerHTML}
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}
