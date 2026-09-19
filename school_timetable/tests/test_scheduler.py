"""
Unit tests for TimetableScheduler algorithm.
Tests:
- Solves conflict-free timetable
- Detects impossible schedules and returns diagnostic reasons
- Respects teacher availability
- Respects maximum daily & weekly periods
- Honors subject requirements per class
"""

import unittest
from app.services.scheduler import TimetableScheduler


class TestTimetableScheduler(unittest.TestCase):
    def setUp(self):
        self.classes = [
            {"id": 1, "name": "8-A"},
            {"id": 2, "name": "8-B"},
        ]
        self.subjects = [
            {"id": 1, "name": "Mathematics", "requires_consecutive": False},
            {"id": 2, "name": "Science", "requires_consecutive": False},
        ]
        self.staff_list = [
            {
                "id": 1,
                "name": "Mr. Kumar",
                "max_periods_per_day": 4,
                "max_periods_per_week": 20,
                "qualified_subject_ids": [1],
            },
            {
                "id": 2,
                "name": "Mr. Arun",
                "max_periods_per_day": 4,
                "max_periods_per_week": 20,
                "qualified_subject_ids": [2],
            },
        ]
        self.assignments = [
            {"class_id": 1, "subject_id": 1, "staff_id": 1},
            {"class_id": 2, "subject_id": 1, "staff_id": 1},
            {"class_id": 1, "subject_id": 2, "staff_id": 2},
            {"class_id": 2, "subject_id": 2, "staff_id": 2},
        ]
        self.class_subjects = [
            {"class_id": 1, "subject_id": 1, "periods_per_week": 3},
            {"class_id": 2, "subject_id": 1, "periods_per_week": 3},
            {"class_id": 1, "subject_id": 2, "periods_per_week": 2},
            {"class_id": 2, "subject_id": 2, "periods_per_week": 2},
        ]
        self.availabilities = [
            {"staff_id": 1, "day": "Monday", "period": 1, "is_available": False}
        ]
        self.active_days = ["Monday", "Tuesday", "Wednesday"]

    def test_successful_conflict_free_generation(self):
        scheduler = TimetableScheduler(
            classes=self.classes,
            subjects=self.subjects,
            staff_list=self.staff_list,
            assignments=self.assignments,
            class_subjects=self.class_subjects,
            availabilities=self.availabilities,
            active_days=self.active_days,
            total_periods=6,
            lunch_period=4,
        )
        result = scheduler.solve()
        self.assertTrue(result.success, "Scheduler should generate a valid timetable")
        self.assertEqual(result.total_scheduled, result.total_required)
        self.assertEqual(result.missing_periods, 0)

        # Verify no double booking for teacher in same day and period
        teacher_slots = set()
        for e in result.entries:
            key = (e["staff_id"], e["day"], e["period"])
            self.assertNotIn(key, teacher_slots, f"Teacher double booked at {key}")
            teacher_slots.add(key)

        # Verify no class has 2 subjects in same period
        class_slots = set()
        for e in result.entries:
            key = (e["class_id"], e["day"], e["period"])
            self.assertNotIn(key, class_slots, f"Class double booked at {key}")
            class_slots.add(key)

        # Verify Mr. Kumar was NOT assigned Monday period 1
        for e in result.entries:
            if e["staff_id"] == 1:
                self.assertFalse(e["day"] == "Monday" and e["period"] == 1)

    def test_impossible_schedule_detection(self):
        """When teacher weekly capacity is lower than required periods, it should fail with clear diagnostics."""
        impossible_staff = [
            {
                "id": 1,
                "name": "Mr. Kumar",
                "max_periods_per_day": 2,
                "max_periods_per_week": 4,  # Only 4 allowed
                "qualified_subject_ids": [1],
            }
        ]
        # But classes require 6 periods total of Mathematics
        scheduler = TimetableScheduler(
            classes=self.classes,
            subjects=self.subjects,
            staff_list=impossible_staff,
            assignments=[{"class_id": 1, "subject_id": 1, "staff_id": 1}, {"class_id": 2, "subject_id": 1, "staff_id": 1}],
            class_subjects=[{"class_id": 1, "subject_id": 1, "periods_per_week": 3}, {"class_id": 2, "subject_id": 1, "periods_per_week": 3}],
            availabilities=[],
            active_days=self.active_days,
            total_periods=6,
        )
        result = scheduler.solve()
        self.assertFalse(result.success, "Should fail impossible timetable generation")
        self.assertGreater(len(result.impossible_reasons), 0)


if __name__ == "__main__":
    unittest.main()
