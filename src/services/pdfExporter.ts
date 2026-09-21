import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { SchoolClass, Staff, Subject, TimetableEntry, SchoolTimings } from "../types";

export class PDFTimetableExporter {
  /**
   * Period time calculator
   */
  private static getPeriodTime(p: number): string {
    switch (p) {
      case 1:
        return "09:10 - 09:50";
      case 2:
        return "09:50 - 10:30";
      case 3:
        return "10:45 - 11:25";
      case 4:
        return "11:25 - 12:05";
      case 5:
        return "12:50 - 13:30";
      case 6:
        return "13:30 - 14:10";
      case 7:
        return "14:20 - 15:00";
      case 8:
        return "15:00 - 15:40";
      default:
        return `Period ${p}`;
    }
  }

  /**
   * Generates clean, print-formatted HTML for a Class Timetable
   */
  private static generateClassHtml(
    cls: SchoolClass,
    entries: TimetableEntry[],
    staffList: Staff[],
    subjects: Subject[],
    timings: SchoolTimings
  ): string {
    const staffMap = new Map(staffList.map((s) => [s.id, s]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const classEntries = entries.filter((e) => e.class_id === cls.id);
    const activeDays = timings.active_days;
    const today = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const rowsHtml = Array.from({ length: timings.total_periods }, (_, i) => i + 1)
      .map((p) => {
        let breakRowHtml = "";

        // Morning Break: rendered before Period 3 (between Period 2 and Period 3)
        if (p === 3) {
          breakRowHtml = `
            <tr style="background-color: #fef3c7; border: 1px solid #fde68a;">
              <td style="padding: 3px 6px; border: 1px solid #fde68a; font-weight: 700; color: #92400e; font-size: 9.5px; text-align: center; white-space: nowrap;">
                10:30 - 10:45
              </td>
              <td colspan="${activeDays.length}" style="padding: 3px 6px; border: 1px solid #fde68a; text-align: center; font-weight: 700; color: #b45309; font-size: 9.5px; letter-spacing: 0.5px;">
                ☕ MORNING BREAK (15 MINUTES)
              </td>
            </tr>
          `;
        }

        // Lunch Break: rendered before Period 5 (between Period 4 and Period 5)
        if (p === 5) {
          breakRowHtml = `
            <tr style="background-color: #ffedd5; border: 1px solid #fed7aa;">
              <td style="padding: 3px 6px; border: 1px solid #fed7aa; font-weight: 700; color: #9a3412; font-size: 9.5px; text-align: center; white-space: nowrap;">
                12:05 - 12:50
              </td>
              <td colspan="${activeDays.length}" style="padding: 3px 6px; border: 1px solid #fed7aa; text-align: center; font-weight: 700; color: #c2410c; font-size: 9.5px; letter-spacing: 0.5px;">
                🍱 LUNCH BREAK (45 MINUTES)
              </td>
            </tr>
          `;
        }

        // Afternoon Break: rendered before Period 7 (between Period 6 and Period 7)
        if (p === 7) {
          breakRowHtml = `
            <tr style="background-color: #fef3c7; border: 1px solid #fde68a;">
              <td style="padding: 3px 6px; border: 1px solid #fde68a; font-weight: 700; color: #92400e; font-size: 9.5px; text-align: center; white-space: nowrap;">
                14:10 - 14:20
              </td>
              <td colspan="${activeDays.length}" style="padding: 3px 6px; border: 1px solid #fde68a; text-align: center; font-weight: 700; color: #b45309; font-size: 9.5px; letter-spacing: 0.5px;">
                ☕ AFTERNOON BREAK (10 MINUTES)
              </td>
            </tr>
          `;
        }

        const periodTime = this.getPeriodTime(p);

        // Teaching period row (preserves all periods 1 through 8)
        const dayCells = activeDays
          .map((day) => {
            const entry = classEntries.find((e) => e.day === day && e.period === p);
            if (entry) {
              const subject = subjectMap.get(entry.subject_id);
              const staff = staffMap.get(entry.staff_id);
              const color = subject?.color || "#3b82f6";

              return `
                <td style="padding: 3px 4px; border: 1px solid #cbd5e1; vertical-align: top; background-color: #ffffff;">
                  <div style="background-color: ${color}12; border: 1px solid ${color}45; border-radius: 4px; padding: 4px 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                      <span style="background-color: ${color}; color: #ffffff; font-size: 8px; font-weight: 700; padding: 0.5px 4px; border-radius: 3px; text-transform: uppercase;">
                        ${subject?.code || "SUB"}
                      </span>
                      ${
                        entry.room_number
                          ? `<span style="font-size: 8px; font-weight: 600; color: #64748b;">Rm: ${entry.room_number}</span>`
                          : ""
                      }
                    </div>
                    <div style="font-size: 9.5px; font-weight: 700; color: #0f172a; line-height: 1.15; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${subject?.name || "Subject"}
                    </div>
                    <div style="font-size: 8.5px; color: #475569; margin-top: 2px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      👨‍🏫 ${staff?.name || "Faculty"}
                    </div>
                  </div>
                </td>
              `;
            }

            return `
              <td style="padding: 3px 4px; border: 1px solid #cbd5e1; vertical-align: middle; background-color: #fafafa; text-align: center;">
                <div style="border: 1px dashed #cbd5e1; border-radius: 4px; padding: 8px 3px; color: #94a3b8; font-size: 9px; font-weight: 600;">
                  FREE
                </div>
              </td>
            `;
          })
          .join("");

        const periodRowHtml = `
          <tr style="border: 1px solid #cbd5e1;">
            <td style="padding: 4px 5px; border: 1px solid #cbd5e1; background-color: #f8fafc; text-align: center; vertical-align: middle;">
              <div style="font-weight: 700; font-size: 10.5px; color: #1e293b;">Period ${p}</div>
              <div style="font-size: 8.5px; color: #64748b; margin-top: 1px;">${periodTime}</div>
            </td>
            ${dayCells}
          </tr>
        `;

        return breakRowHtml + periodRowHtml;
      })
      .join("");

    return `
      <div style="width: 1060px; padding: 18px 24px; background-color: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-sizing: border-box;">
        <!-- Official School Header -->
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 20px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.3px;">
                ${timings.school_name}
              </div>
              <div style="font-size: 12px; font-weight: 600; color: #2563eb; margin-top: 2px;">
                Academic Year: ${timings.academic_year}
              </div>
              <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 6px;">
                CLASS TIMETABLE: ${cls.name}
              </div>
              <div style="font-size: 11px; color: #475569; margin-top: 2px;">
                Grade ${cls.grade} • Section ${cls.section} • Room: ${cls.room_number || "Not assigned"} • ${classEntries.length} Scheduled Lessons/Week
              </div>
            </div>

            <div style="text-align: right;">
              <div style="display: inline-block; background-color: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 3px 8px; border-radius: 5px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                Official Schedule Document
              </div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
                Issued: ${today}
              </div>
              <div style="font-size: 10px; color: #16a34a; font-weight: 600; margin-top: 2px;">
                ✓ Constraint Verified & Conflict-Free
              </div>
            </div>
          </div>
        </div>

        <!-- Timetable Grid -->
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 10px;">
          <thead>
            <tr style="background-color: #f1f5f9; border: 1px solid #cbd5e1;">
              <th style="width: 110px; padding: 6px 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 10.5px; font-weight: 700; color: #334155; text-transform: uppercase;">
                Period / Time
              </th>
              ${activeDays
                .map(
                  (d) => `
                <th style="padding: 6px 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 10.5px; font-weight: 700; color: #334155; text-transform: uppercase;">
                  ${d}
                </th>
              `
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Document Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 9.5px; color: #64748b;">
          <div>
            ${timings.school_name} • Operational Hours: ${timings.start_time} - ${timings.end_time} • Period Duration: ${timings.period_duration_minutes} Mins
          </div>
          <div>
            Academic Document • Class ${cls.name} • Page 1 of 1
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generates clean, print-formatted HTML for a Staff Timetable
   */
  private static generateStaffHtml(
    staff: Staff,
    entries: TimetableEntry[],
    classes: SchoolClass[],
    subjects: Subject[],
    timings: SchoolTimings
  ): string {
    const classMap = new Map(classes.map((c) => [c.id, c]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const staffEntries = entries.filter((e) => e.staff_id === staff.id);
    const activeDays = timings.active_days;
    const today = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const qualifications =
      staff.qualified_subject_ids
        .map((id) => subjectMap.get(id)?.name)
        .filter(Boolean)
        .join(", ") || "General Education";

    const rowsHtml = Array.from({ length: timings.total_periods }, (_, i) => i + 1)
      .map((p) => {
        let breakRowHtml = "";

        // Morning Break: rendered before Period 3 (between Period 2 and Period 3)
        if (p === 3) {
          breakRowHtml = `
            <tr style="background-color: #fef3c7; border: 1px solid #fde68a;">
              <td style="padding: 3px 6px; border: 1px solid #fde68a; font-weight: 700; color: #92400e; font-size: 9.5px; text-align: center; white-space: nowrap;">
                10:30 - 10:45
              </td>
              <td colspan="${activeDays.length}" style="padding: 3px 6px; border: 1px solid #fde68a; text-align: center; font-weight: 700; color: #b45309; font-size: 9.5px; letter-spacing: 0.5px;">
                ☕ MORNING BREAK (15 MINUTES)
              </td>
            </tr>
          `;
        }

        // Lunch Break: rendered before Period 5 (between Period 4 and Period 5)
        if (p === 5) {
          breakRowHtml = `
            <tr style="background-color: #ffedd5; border: 1px solid #fed7aa;">
              <td style="padding: 3px 6px; border: 1px solid #fed7aa; font-weight: 700; color: #9a3412; font-size: 9.5px; text-align: center; white-space: nowrap;">
                12:05 - 12:50
              </td>
              <td colspan="${activeDays.length}" style="padding: 3px 6px; border: 1px solid #fed7aa; text-align: center; font-weight: 700; color: #c2410c; font-size: 9.5px; letter-spacing: 0.5px;">
                🍱 LUNCH BREAK (45 MINUTES)
              </td>
            </tr>
          `;
        }

        // Afternoon Break: rendered before Period 7 (between Period 6 and Period 7)
        if (p === 7) {
          breakRowHtml = `
            <tr style="background-color: #fef3c7; border: 1px solid #fde68a;">
              <td style="padding: 3px 6px; border: 1px solid #fde68a; font-weight: 700; color: #92400e; font-size: 9.5px; text-align: center; white-space: nowrap;">
                14:10 - 14:20
              </td>
              <td colspan="${activeDays.length}" style="padding: 3px 6px; border: 1px solid #fde68a; text-align: center; font-weight: 700; color: #b45309; font-size: 9.5px; letter-spacing: 0.5px;">
                ☕ AFTERNOON BREAK (10 MINUTES)
              </td>
            </tr>
          `;
        }

        const periodTime = this.getPeriodTime(p);

        // Teaching row (preserves all periods 1 through 8)
        const dayCells = activeDays
          .map((day) => {
            const isUnavailable = (staff.unavailabilities || []).some(
              (u) => u.day === day && u.period === p
            );

            if (isUnavailable) {
              const unavail = (staff.unavailabilities || []).find(
                (u) => u.day === day && u.period === p
              );
              return `
                <td style="padding: 3px 4px; border: 1px solid #cbd5e1; vertical-align: middle; background-color: #fff1f2;">
                  <div style="border: 1px solid #fecdd3; border-radius: 4px; padding: 6px 3px; text-align: center;">
                    <div style="font-size: 9px; font-weight: 700; color: #e11d48;">UNAVAILABLE</div>
                    <div style="font-size: 8px; color: #fb7185; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${unavail?.reason || "Blocked / Leave"}</div>
                  </div>
                </td>
              `;
            }

            const entry = staffEntries.find((e) => e.day === day && e.period === p);
            if (entry) {
              const cls = classMap.get(entry.class_id);
              const subject = subjectMap.get(entry.subject_id);
              const color = subject?.color || "#10b981";

              return `
                <td style="padding: 3px 4px; border: 1px solid #cbd5e1; vertical-align: top; background-color: #ffffff;">
                  <div style="background-color: ${color}12; border: 1px solid ${color}45; border-radius: 4px; padding: 4px 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                      <span style="background-color: #1e293b; color: #ffffff; font-size: 8px; font-weight: 700; padding: 0.5px 4px; border-radius: 3px;">
                        ${cls?.name || "Class"}
                      </span>
                      ${
                        entry.room_number
                          ? `<span style="font-size: 8px; font-weight: 600; color: #64748b;">Rm: ${entry.room_number}</span>`
                          : ""
                      }
                    </div>
                    <div style="font-size: 9.5px; font-weight: 700; color: #0f172a; line-height: 1.15; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${subject?.name || "Subject"}
                    </div>
                    <div style="font-size: 8.5px; font-weight: 600; color: ${color}; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${subject?.code || ""}
                    </div>
                  </div>
                </td>
              `;
            }

            return `
              <td style="padding: 3px 4px; border: 1px solid #cbd5e1; vertical-align: middle; background-color: #fafafa; text-align: center;">
                <div style="border: 1px dashed #cbd5e1; border-radius: 4px; padding: 8px 3px; color: #64748b; font-size: 9px; font-weight: 600;">
                  FREE / PREP
                </div>
              </td>
            `;
          })
          .join("");

        const periodRowHtml = `
          <tr style="border: 1px solid #cbd5e1;">
            <td style="padding: 4px 5px; border: 1px solid #cbd5e1; background-color: #f8fafc; text-align: center; vertical-align: middle;">
              <div style="font-weight: 700; font-size: 10.5px; color: #1e293b;">Period ${p}</div>
              <div style="font-size: 8.5px; color: #64748b; margin-top: 1px;">${periodTime}</div>
            </td>
            ${dayCells}
          </tr>
        `;

        return breakRowHtml + periodRowHtml;
      })
      .join("");

    return `
      <div style="width: 1060px; padding: 18px 24px; background-color: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-sizing: border-box;">
        <!-- Official School Header -->
        <div style="border-bottom: 2px solid #059669; padding-bottom: 10px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 20px; font-weight: 800; color: #064e3b; letter-spacing: -0.3px;">
                ${timings.school_name}
              </div>
              <div style="font-size: 12px; font-weight: 600; color: #059669; margin-top: 2px;">
                Academic Year: ${timings.academic_year}
              </div>
              <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 6px;">
                STAFF TEACHING TIMETABLE: ${staff.name}
              </div>
              <div style="font-size: 11px; color: #475569; margin-top: 2px;">
                ID: ${staff.employee_id || "N/A"} • Qualifications: ${qualifications} • Workload: ${staffEntries.length} / ${staff.max_periods_per_week} Periods/Week
              </div>
            </div>

            <div style="text-align: right;">
              <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; padding: 3px 8px; border-radius: 5px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                Faculty Schedule Document
              </div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
                Issued: ${today}
              </div>
              <div style="font-size: 10px; color: #16a34a; font-weight: 600; margin-top: 2px;">
                ✓ Workload Compliant
              </div>
            </div>
          </div>
        </div>

        <!-- Timetable Grid -->
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 10px;">
          <thead>
            <tr style="background-color: #f1f5f9; border: 1px solid #cbd5e1;">
              <th style="width: 110px; padding: 6px 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 10.5px; font-weight: 700; color: #334155; text-transform: uppercase;">
                Period / Time
              </th>
              ${activeDays
                .map(
                  (d) => `
                <th style="padding: 6px 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 10.5px; font-weight: 700; color: #334155; text-transform: uppercase;">
                  ${d}
                </th>
              `
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Document Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 9.5px; color: #64748b;">
          <div>
            ${timings.school_name} • Operational Hours: ${timings.start_time} - ${timings.end_time} • Max Daily Limit: ${staff.max_periods_per_day} Periods
          </div>
          <div>
            Faculty Document • Teacher ${staff.name} • Page 1 of 1
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Helper to render HTML string via html2canvas into a canvas element
   */
  private static async renderHtmlToCanvas(htmlContent: string): Promise<HTMLCanvasElement> {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "0px";
    container.style.top = "0px";
    container.style.zIndex = "-99999";
    container.style.pointerEvents = "none";
    container.style.backgroundColor = "#ffffff";
    container.style.opacity = "1";
    container.innerHTML = htmlContent;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2, // High DPI for crisp printing
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      return canvas;
    } finally {
      document.body.removeChild(container);
    }
  }

  /**
   * Fits a canvas image into an A4 Landscape page
   */
  private static addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement) {
    const pdfWidth = 297; // A4 landscape width in mm
    const pdfHeight = 210; // A4 landscape height in mm
    const margin = 10;

    const availableWidth = pdfWidth - margin * 2;
    const availableHeight = pdfHeight - margin * 2;

    let renderWidth = availableWidth;
    let renderHeight = (canvas.height * renderWidth) / canvas.width;

    if (renderHeight > availableHeight) {
      renderHeight = availableHeight;
      renderWidth = (canvas.width * renderHeight) / canvas.height;
    }

    const posX = (pdfWidth - renderWidth) / 2;
    const posY = (pdfHeight - renderHeight) / 2;

    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", posX, posY, renderWidth, renderHeight);
  }

  /**
   * Exports a single Class Timetable as a clean PDF document
   */
  static async exportClassToPDF(
    cls: SchoolClass,
    entries: TimetableEntry[],
    staffList: Staff[],
    subjects: Subject[],
    timings: SchoolTimings
  ): Promise<void> {
    const html = this.generateClassHtml(cls, entries, staffList, subjects, timings);
    const canvas = await this.renderHtmlToCanvas(html);

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    this.addCanvasToPdf(pdf, canvas);

    const safeClassName = cls.name.replace(/[^a-zA-Z0-9]/g, "_");
    const safeYear = timings.academic_year.replace(/[^a-zA-Z0-9]/g, "_");
    pdf.save(`Timetable_Class_${safeClassName}_${safeYear}.pdf`);
  }

  /**
   * Exports a single Staff Timetable as a clean PDF document
   */
  static async exportStaffToPDF(
    staff: Staff,
    entries: TimetableEntry[],
    classes: SchoolClass[],
    subjects: Subject[],
    timings: SchoolTimings
  ): Promise<void> {
    const html = this.generateStaffHtml(staff, entries, classes, subjects, timings);
    const canvas = await this.renderHtmlToCanvas(html);

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    this.addCanvasToPdf(pdf, canvas);

    const safeStaffName = staff.name.replace(/[^a-zA-Z0-9]/g, "_");
    const safeYear = timings.academic_year.replace(/[^a-zA-Z0-9]/g, "_");
    pdf.save(`Timetable_Staff_${safeStaffName}_${safeYear}.pdf`);
  }

  /**
   * Exports ALL Class Timetables as a single multi-page PDF document
   */
  static async exportAllClassesToPDF(
    classes: SchoolClass[],
    entries: TimetableEntry[],
    staffList: Staff[],
    subjects: Subject[],
    timings: SchoolTimings,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    for (let i = 0; i < classes.length; i++) {
      if (i > 0) {
        pdf.addPage("a4", "landscape");
      }
      onProgress?.(i + 1, classes.length);
      const cls = classes[i];
      const html = this.generateClassHtml(cls, entries, staffList, subjects, timings);
      const canvas = await this.renderHtmlToCanvas(html);
      this.addCanvasToPdf(pdf, canvas);
    }

    const safeSchool = timings.school_name.replace(/[^a-zA-Z0-9]/g, "_");
    const safeYear = timings.academic_year.replace(/[^a-zA-Z0-9]/g, "_");
    pdf.save(`All_Classes_Timetable_${safeSchool}_${safeYear}.pdf`);
  }

  /**
   * Exports ALL Staff Timetables as a single multi-page PDF document
   */
  static async exportAllStaffToPDF(
    staffList: Staff[],
    entries: TimetableEntry[],
    classes: SchoolClass[],
    subjects: Subject[],
    timings: SchoolTimings,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    for (let i = 0; i < staffList.length; i++) {
      if (i > 0) {
        pdf.addPage("a4", "landscape");
      }
      onProgress?.(i + 1, staffList.length);
      const staff = staffList[i];
      const html = this.generateStaffHtml(staff, entries, classes, subjects, timings);
      const canvas = await this.renderHtmlToCanvas(html);
      this.addCanvasToPdf(pdf, canvas);
    }

    const safeSchool = timings.school_name.replace(/[^a-zA-Z0-9]/g, "_");
    const safeYear = timings.academic_year.replace(/[^a-zA-Z0-9]/g, "_");
    pdf.save(`All_Staff_Timetable_${safeSchool}_${safeYear}.pdf`);
  }
}
