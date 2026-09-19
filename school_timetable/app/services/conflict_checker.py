"""
Comprehensive Conflict Checker Service.
Audits timetables against hard constraints and soft constraints:
- Teacher double booking
- Class double booking
- Teacher availability violations
- Teacher qualification mismatches
- Teacher daily overload
- Teacher weekly overload
- Missing or extra subject periods
- Break/lunch period overlaps
"""

from typing import List, Dict, Any, Optional
from collections import defaultdict
from app.schemas import ConflictItem


class ConflictChecker:
    @staticmethod
    def audit_timetable(
        entries: List[Dict[str, Any]],
        classes: List[Dict[str, Any]],
        staff_list: List[Dict[str, Any]],
        subjects: List[Dict[str, Any]],
        assignments: List[Dict[str, Any]],
        availabilities: List[Dict[str, Any]],
        class_subjects: List[Dict[str, Any]],
        active_days: List[str],
        total_periods: int = 8,
        lunch_period: Optional[int] = None,
        break_periods: Optional[List[int]] = None,
    ) -> List[ConflictItem]:
        conflicts: List[ConflictItem] = []
        break_periods = break_periods or []

        # Maps for quick lookups
        class_map = {c["id"]: c["name"] for c in classes}
        staff_map = {s["id"]: s for s in staff_list}
        subject_map = {sub["id"]: sub for sub in subjects}

        # 1. HARD CONSTRAINT: Teacher Double Booking
        # teacher_id + day + period must be unique
        teacher_slots: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for e in entries:
            key = f"{e['staff_id']}_{e['day']}_{e['period']}"
            teacher_slots[key].append(e)

        for key, slot_entries in teacher_slots.items():
            if len(slot_entries) > 1:
                st_id = slot_entries[0]["staff_id"]
                st_name = staff_map.get(st_id, {}).get("name", f"Teacher #{st_id}")
                day = slot_entries[0]["day"]
                period = slot_entries[0]["period"]
                cls_names = [class_map.get(x["class_id"], f"Class {x['class_id']}") for x in slot_entries]
                sub_names = [subject_map.get(x["subject_id"], {}).get("name", "Subject") for x in slot_entries]

                conflicts.append(ConflictItem(
                    severity="high",
                    conflict_type="teacher_double_booking",
                    day=day,
                    period=period,
                    staff_name=st_name,
                    class_name=", ".join(cls_names),
                    subject_name=", ".join(sub_names),
                    explanation=f"Teacher {st_name} is simultaneously double-booked to teach classes ({', '.join(cls_names)}) on {day} Period {period}.",
                    suggested_fix=f"Reschedule one of the classes to a free period for {st_name} or assign an alternate qualified teacher."
                ))

        # 2. HARD CONSTRAINT: Class Double Booking
        # class_id + day + period must be unique
        class_slots: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for e in entries:
            key = f"{e['class_id']}_{e['day']}_{e['period']}"
            class_slots[key].append(e)

        for key, slot_entries in class_slots.items():
            if len(slot_entries) > 1:
                c_id = slot_entries[0]["class_id"]
                c_name = class_map.get(c_id, f"Class #{c_id}")
                day = slot_entries[0]["day"]
                period = slot_entries[0]["period"]
                sub_names = [subject_map.get(x["subject_id"], {}).get("name", "Subject") for x in slot_entries]
                st_names = [staff_map.get(x["staff_id"], {}).get("name", "Teacher") for x in slot_entries]

                conflicts.append(ConflictItem(
                    severity="high",
                    conflict_type="class_double_booking",
                    day=day,
                    period=period,
                    class_name=c_name,
                    staff_name=", ".join(st_names),
                    subject_name=", ".join(sub_names),
                    explanation=f"Class {c_name} has multiple subjects ({', '.join(sub_names)}) scheduled at the same time on {day} Period {period}.",
                    suggested_fix=f"Move one subject to an open period on {day} or another active weekday."
                ))

        # 3. HARD CONSTRAINT: Teacher Availability
        unavail_set = set()
        for a in availabilities:
            if not a.get("is_available", True):
                unavail_set.add((a["staff_id"], a["day"], a["period"]))

        for e in entries:
            if (e["staff_id"], e["day"], e["period"]) in unavail_set:
                st_name = staff_map.get(e["staff_id"], {}).get("name", f"Teacher #{e['staff_id']}")
                c_name = class_map.get(e["class_id"], f"Class #{e['class_id']}")
                sub_name = subject_map.get(e["subject_id"], {}).get("name", "Subject")
                conflicts.append(ConflictItem(
                    severity="high",
                    conflict_type="teacher_unavailable",
                    day=e["day"],
                    period=e["period"],
                    class_name=c_name,
                    staff_name=st_name,
                    subject_name=sub_name,
                    explanation=f"{st_name} is marked unavailable on {e['day']} Period {e['period']}, but is assigned to teach {c_name} ({sub_name}).",
                    suggested_fix=f"Move this lesson to when {st_name} is available, or adjust {st_name}'s availability preferences."
                ))

        # 4. HARD CONSTRAINT: Teacher Qualification
        # Teacher must be qualified for subject
        staff_qual_map: Dict[int, set] = defaultdict(set)
        for s in staff_list:
            for sub_id in s.get("qualified_subject_ids", []):
                staff_qual_map[s["id"]].add(sub_id)

        for e in entries:
            st_id = e["staff_id"]
            sub_id = e["subject_id"]
            if sub_id not in staff_qual_map.get(st_id, set()):
                st_name = staff_map.get(st_id, {}).get("name", f"Teacher #{st_id}")
                c_name = class_map.get(e["class_id"], f"Class #{e['class_id']}")
                sub_name = subject_map.get(sub_id, {}).get("name", f"Subject #{sub_id}")
                conflicts.append(ConflictItem(
                    severity="high",
                    conflict_type="qualification_mismatch",
                    day=e["day"],
                    period=e["period"],
                    class_name=c_name,
                    staff_name=st_name,
                    subject_name=sub_name,
                    explanation=f"{st_name} is teaching {sub_name} for {c_name} on {e['day']} Period {e['period']}, but is not listed as qualified for {sub_name}.",
                    suggested_fix=f"Update {st_name}'s qualified subjects or assign a qualified teacher."
                ))

        # 5. HARD CONSTRAINT: Teacher Daily & Weekly Overload
        teacher_daily_counts: Dict[str, int] = defaultdict(int)
        teacher_weekly_counts: Dict[int, int] = defaultdict(int)

        for e in entries:
            st_id = e["staff_id"]
            day = e["day"]
            teacher_daily_counts[f"{st_id}_{day}"] += 1
            teacher_weekly_counts[st_id] += 1

        for st_id, staff_obj in staff_map.items():
            max_day = staff_obj.get("max_periods_per_day", 6)
            max_week = staff_obj.get("max_periods_per_week", 30)

            for d in active_days:
                count = teacher_daily_counts.get(f"{st_id}_{d}", 0)
                if count > max_day:
                    conflicts.append(ConflictItem(
                        severity="medium",
                        conflict_type="daily_overload",
                        day=d,
                        staff_name=staff_obj["name"],
                        explanation=f"{staff_obj['name']} is assigned {count} periods on {d}, exceeding their maximum limit of {max_day} periods/day.",
                        suggested_fix=f"Shift some periods from {d} to another day with lighter workload."
                    ))

            week_count = teacher_weekly_counts.get(st_id, 0)
            if week_count > max_week:
                conflicts.append(ConflictItem(
                    severity="high",
                    conflict_type="weekly_overload",
                    staff_name=staff_obj["name"],
                    explanation=f"{staff_obj['name']} has {week_count} total periods assigned this week, exceeding the weekly maximum of {max_week}.",
                    suggested_fix=f"Reassign some classes/periods to another staff member."
                ))

        # 6. HARD CONSTRAINT: Subject Weekly Requirements (Missing / Extra)
        required_map: Dict[str, int] = {}
        for cs in class_subjects:
            required_map[f"{cs['class_id']}_{cs['subject_id']}"] = cs["periods_per_week"]

        scheduled_counts: Dict[str, int] = defaultdict(int)
        for e in entries:
            scheduled_counts[f"{e['class_id']}_{e['subject_id']}"] += 1

        for key, req_count in required_map.items():
            c_id_str, s_id_str = key.split("_")
            c_id, s_id = int(c_id_str), int(s_id_str)
            actual_count = scheduled_counts.get(key, 0)
            c_name = class_map.get(c_id, f"Class #{c_id}")
            sub_name = subject_map.get(s_id, {}).get("name", f"Subject #{s_id}")

            if actual_count < req_count:
                missing = req_count - actual_count
                conflicts.append(ConflictItem(
                    severity="high",
                    conflict_type="missing_subject_periods",
                    class_name=c_name,
                    subject_name=sub_name,
                    explanation=f"{c_name} requires {req_count} periods/week of {sub_name}, but only {actual_count} are scheduled (Missing: {missing}).",
                    suggested_fix=f"Generate or assign {missing} more period(s) for {sub_name} in {c_name}."
                ))
            elif actual_count > req_count:
                extra = actual_count - req_count
                conflicts.append(ConflictItem(
                    severity="medium",
                    conflict_type="extra_subject_periods",
                    class_name=c_name,
                    subject_name=sub_name,
                    explanation=f"{c_name} has {actual_count} periods of {sub_name} scheduled, exceeding the required {req_count} by {extra} period(s).",
                    suggested_fix=f"Remove {extra} extra period(s) of {sub_name} from {c_name}'s schedule."
                ))

        # 7. HARD CONSTRAINT: Break and Lunch overlaps
        for e in entries:
            p = e["period"]
            if lunch_period is not None and p == lunch_period:
                c_name = class_map.get(e["class_id"], f"Class #{e['class_id']}")
                conflicts.append(ConflictItem(
                    severity="high",
                    conflict_type="lunch_overlap",
                    day=e["day"],
                    period=p,
                    class_name=c_name,
                    explanation=f"Class {c_name} is scheduled during designated Lunch time (Period {p}).",
                    suggested_fix="Move class to an academic period."
                ))
            if p in break_periods:
                c_name = class_map.get(e["class_id"], f"Class #{e['class_id']}")
                conflicts.append(ConflictItem(
                    severity="high",
                    conflict_type="break_overlap",
                    day=e["day"],
                    period=p,
                    class_name=c_name,
                    explanation=f"Class {c_name} is scheduled during designated Break period (Period {p}).",
                    suggested_fix="Move class to an instructional period."
                ))

        return conflicts
