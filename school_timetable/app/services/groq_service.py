"""
Groq AI Service for optional natural-language assistant features:
- Parses plain text setup commands into structured data
- Explains scheduling conflicts in clear human language
- Validates all LLM output with Pydantic before touching the database
- Gracefully falls back when API key is missing or offline
"""

import os
import json
from typing import Dict, Any, Optional

try:
    from pydantic import ValidationError
except ImportError:
    class ValidationError(Exception):
        pass

from app.schemas import GroqParsedData


class GroqService:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.client = None
        if self.api_key:
            try:
                from groq import Groq
                self.client = Groq(api_key=self.api_key)
            except ImportError:
                self.client = None

    def is_available(self) -> bool:
        return bool(self.api_key and self.client)

    def parse_instruction(self, text_instruction: str) -> Dict[str, Any]:
        """
        Takes raw natural language like:
        'Mr Kumar teaches maths for 8A, 8B and 9A. He is not available Monday period 3.'
        Returns validated structured data via Groq or fallback rule parser.
        """
        system_prompt = (
            "You are a school scheduling assistant. Convert the user's natural language setup instruction into structured JSON.\n"
            "Format:\n"
            "{\n"
            '  "staff_name": "Teacher Name or null",\n'
            '  "subject_name": "Subject Name or null",\n'
            '  "class_names": ["8-A", "8-B"],\n'
            '  "periods_per_week": integer or null,\n'
            '  "unavailable": [\n'
            '    {"day": "Monday", "period": 3}\n'
            "  ],\n"
            '  "notes": "Any additional context or null"\n'
            "}\n"
            "Output ONLY valid JSON. Standardize class names to include hyphen (e.g. 8A -> 8-A)."
        )

        if self.is_available():
            try:
                chat_completion = self.client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": text_instruction},
                    ],
                    model="llama-3.3-70b-versatile",
                    response_format={"type": "json_object"},
                    temperature=0.1,
                )
                raw_json = chat_completion.choices[0].message.content
                data = json.loads(raw_json)
                # Strict Pydantic validation
                validated = GroqParsedData(**data)
                return {"success": True, "data": validated.model_dump(), "source": "groq"}
            except Exception as e:
                # If API call fails, proceed to fallback deterministic parser
                pass

        # Fallback deterministic pattern extractor (offline / no API key)
        return self._fallback_rule_parser(text_instruction)

    def explain_conflict(self, conflict_data: Dict[str, Any]) -> str:
        """
        Explains a scheduling conflict using Groq if available, or deterministic rule templates.
        Constrained strictly to provided facts.
        """
        if self.is_available():
            prompt = (
                "You are an academic timetable advisor. Explain this timetable conflict simply to a school administrator "
                "in 2-3 concise sentences and recommend the best concrete action based ONLY on these facts:\n"
                f"{json.dumps(conflict_data, indent=2)}"
            )
            try:
                response = self.client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": "You are a concise school timetable expert. Output plain text advice only."},
                        {"role": "user", "content": prompt},
                    ],
                    model="llama-3.3-70b-versatile",
                    temperature=0.2,
                    max_tokens=150,
                )
                return response.choices[0].message.content.strip()
            except Exception:
                pass

        # Fallback explanation
        c_type = conflict_data.get("conflict_type", "unknown")
        day = conflict_data.get("day", "")
        period = conflict_data.get("period", "")
        c_name = conflict_data.get("class_name", "")
        st_name = conflict_data.get("staff_name", "")
        sub_name = conflict_data.get("subject_name", "")

        if c_type == "teacher_double_booking":
            return (
                f"Double booking alert: {st_name} is simultaneously scheduled to teach multiple classes "
                f"({c_name}) on {day} during Period {period}. Move one class to a free period or reassign a second teacher."
            )
        elif c_type == "class_double_booking":
            return (
                f"Class conflict: {c_name} has multiple subjects scheduled during {day} Period {period}. "
                f"Shift one of the subjects to an open slot on another day."
            )
        elif c_type == "teacher_unavailable":
            return (
                f"Availability clash: {st_name} cannot teach during {day} Period {period} due to declared unavailability. "
                f"Reschedule this {c_name} {sub_name} lesson to when {st_name} is free."
            )
        elif c_type == "missing_subject_periods":
            return (
                f"Incomplete curriculum requirement: {c_name} has not met the required weekly hours for {sub_name}. "
                f"Check teacher availability and class timetable capacity to add remaining periods."
            )
        return conflict_data.get("explanation", "Review timetable constraints and adjust teacher assignments.")

    def _fallback_rule_parser(self, text: str) -> Dict[str, Any]:
        """Simple rule-based fallback when Groq API key is not present."""
        import re
        classes = re.findall(r"\b([0-9]{1,2}\s*[-–]?\s*[A-Za-z])\b", text)
        classes_clean = [c.replace(" ", "").replace("–", "-") for c in classes]
        # Standardize 8A to 8-A
        standardized_classes = []
        for c in classes_clean:
            if "-" not in c:
                standardized_classes.append(f"{c[:-1]}-{c[-1].upper()}")
            else:
                standardized_classes.append(c.upper())

        staff_match = re.search(r"(Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Za-z]+)", text, re.IGNORECASE)
        staff_name = staff_match.group(0) if staff_match else None

        subjects = ["Mathematics", "Maths", "Science", "English", "Tamil", "Hindi", "Social Science", "Computer Science", "PE"]
        found_subject = None
        for s in subjects:
            if s.lower() in text.lower():
                found_subject = "Mathematics" if s.lower() == "maths" else s
                break

        unavail = []
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        for d in days:
            if d.lower() in text.lower() and ("not available" in text.lower() or "free" in text.lower() or "unavailable" in text.lower()):
                p_match = re.search(rf"{d}\s+(?:period\s+)?(\d+)", text, re.IGNORECASE)
                if p_match:
                    unavail.append({"day": d, "period": int(p_match.group(1))})

        return {
            "success": True,
            "data": {
                "staff_name": staff_name,
                "subject_name": found_subject,
                "class_names": list(set(standardized_classes)),
                "periods_per_week": None,
                "unavailable": unavail,
                "notes": "Parsed using local rule extractor (Groq API key not set or offline).",
            },
            "source": "fallback",
        }
