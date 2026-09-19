import { ConflictItem } from "../types";

export interface ParsedAIData {
  staff_name?: string;
  subject_name?: string;
  class_names?: string[];
  max_periods_per_day?: number;
  max_periods_per_week?: number;
  unavailable?: { day: string; period: number; reason?: string }[];
  instruction_type?: string;
}

export class GroqService {
  static async parsePrompt(prompt: string, apiKey?: string): Promise<{ success: boolean; data: ParsedAIData; raw?: any }> {
    if (apiKey && apiKey.trim().startsWith("gsk_")) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  'You are an assistant for a School Timetable Management System. Parse the user instruction into JSON with keys: staff_name (string), subject_name (string), class_names (list of strings like "8-A"), max_periods_per_day (int), max_periods_per_week (int), unavailable (list of {day, period, reason}). Return only valid JSON.',
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
          }),
        });
        if (response.ok) {
          const resJson = await response.json();
          const parsed = JSON.parse(resJson.choices[0].message.content);
          return { success: true, data: parsed, raw: resJson };
        }
      } catch (err) {
        console.warn("Groq API call error, falling back to rule-based parser:", err);
      }
    }

    // Deterministic Rule-Based Fallback
    return {
      success: true,
      data: this.fallbackRuleParser(prompt),
    };
  }

  static fallbackRuleParser(prompt: string): ParsedAIData {
    const data: ParsedAIData = {
      unavailable: [],
      class_names: [],
    };

    // Teacher extraction
    const teacherMatch = prompt.match(/(?:Mr\.|Mrs\.|Ms\.|Dr\.|Coach)\s+[A-Za-z]+/i);
    if (teacherMatch) {
      data.staff_name = teacherMatch[0];
    }

    // Subject extraction
    const subjects = [
      "Mathematics",
      "Maths",
      "English",
      "Science",
      "Physics",
      "Chemistry",
      "Biology",
      "Tamil",
      "Social Science",
      "Computer Science",
      "Physical Education",
      "Art & Music",
      "Art",
    ];
    for (const sub of subjects) {
      if (new RegExp(`\\b${sub}\\b`, "i").test(prompt)) {
        data.subject_name = sub === "Maths" ? "Mathematics" : sub;
        break;
      }
    }

    // Class extraction (e.g. 8-A, 8A, 9-B, 10A)
    const classMatches = prompt.match(/\b\d{1,2}[- ]?[A-E]\b/gi);
    if (classMatches) {
      data.class_names = Array.from(
        new Set(classMatches.map((c) => c.replace(/\s+/g, "").toUpperCase().replace(/(\d+)([A-E])/, "$1-$2")))
      );
    }

    // Unavailability extraction (e.g. Monday period 3, Tuesday 4th period)
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (const d of days) {
      if (new RegExp(`\\b${d}\\b`, "i").test(prompt)) {
        const periodMatch = prompt.match(/(?:period\s*(\d)|(\d)(?:st|nd|rd|th)?\s*period)/i);
        const pNum = periodMatch ? parseInt(periodMatch[1] || periodMatch[2], 10) : 1;
        data.unavailable!.push({
          day: d,
          period: pNum,
          reason: "Parsed from prompt",
        });
      }
    }

    return data;
  }

  static explainConflict(conflict: ConflictItem): string {
    if (conflict.conflict_type === "teacher_double_booking") {
      return `Teacher ${conflict.staff_name} is simultaneously scheduled to teach multiple classes (${conflict.class_name}) on ${conflict.day} during Period ${conflict.period}. A teacher cannot be in two classrooms at the same time.`;
    }
    if (conflict.conflict_type === "class_double_booking") {
      return `Class ${conflict.class_name} has multiple subjects scheduled in the exact same time slot on ${conflict.day} Period ${conflict.period}. Students cannot attend two subjects simultaneously.`;
    }
    if (conflict.conflict_type === "teacher_unavailable") {
      return `Teacher ${conflict.staff_name} is marked unavailable on ${conflict.day} Period ${conflict.period} (e.g., leave, meeting, or part-time off), but has been assigned a period with ${conflict.class_name}.`;
    }
    if (conflict.conflict_type === "daily_overload") {
      return `Teacher ${conflict.staff_name} has exceeded their configured daily maximum workload on ${conflict.day}. This violates teacher well-being constraints.`;
    }
    return conflict.explanation;
  }
}
