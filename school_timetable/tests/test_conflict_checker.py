"""
Unit tests for Conflict Checker and Hard/Soft Constraints.
Tests:
- Teacher double booking
- Class double booking
- Teacher qualification mismatch
- Teacher unavailability violation
- Teacher daily period limit overload
- Teacher weekly period limit overload
- Subject weekly requirement missing or extra
- Break & Lunch period overlaps
"""

import unittest
from app.services.conflict_checker import ConflictChecker


class TestConflictChecker(unittest.TestCase):
    def setUp(self):
        self.classes = [
            {"id": 1, "name": "8-A"},
            {"id": 2, "name": "8-B"},
        ]
        self.subjects = [
            {"id": 1, "name": "Mathematics"},
            {"id": 2, "name": "Science"},
        ]
        self.staff_list = [
            {
                "id": 1,
                "name": "Mr. Kumar",
                "max_periods_per_day": 3,
                "max_periods_per_week": 10,
                "qualified_subject_ids": [1],
            },
            {
                "id": 2,
                "name": "Mr. Arun",
                "max_periods_per_day": 4,
                "max_periods_per_week": 15,
                "qualified_subject_ids": [2],
            },
        ]
        self.assignments = [
            {"class_id": 1, "subject_id": 1, "staff_id": 1},
            {"class_id": 2, "subject_id": 1, "staff_id": 1},
            {"class_id": 1, "subject_id": 2, "staff_id": 2},
        ]
        self.class_subjects = [
            {"class_id": 1, "subject_id": 1, "periods_per_week": 2},
            {"class_id": 2, "subject_id": 1, "periods_per_week": 2},
            {"class_id": 1, "subject_id": 2, "periods_per_week": 2},
        ]
        self.availabilities = [
            {"staff_id": 1, "day": "Monday", "period": 3, "is_available": False}
        ]
        self.active_days = ["Monday", "Tuesday"]

    def test_teacher_double_booking_detected(self):
        """Mr. Kumar cannot teach 8-A and 8-B simultaneously during Monday Period 1."""
        entries = [
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Monday", "period": 1},
            {"staff_id": 1, "class_id": 2, "subject_id": 1, "day": "Monday", "period": 1},  # CONFLICT
        ]
        conflicts = ConflictChecker.audit_timetable(
            entries=entries,
            classes=self.classes,
            staff_list=self.staff_list,
            subjects=self.subjects,
            assignments=self.assignments,
            availabilities=self.availabilities,
            class_subjects=self.class_subjects,
            active_days=self.active_days,
            total_periods=8,
        )
        types = [c.conflict_type for c in conflicts]
        self.assertIn("teacher_double_booking", types)

    def test_class_double_booking_detected(self):
        """8-A cannot have Mathematics and Science in the same period."""
        entries = [
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Monday", "period": 2},
            {"staff_id": 2, "class_id": 1, "subject_id": 2, "day": "Monday", "period": 2},  # CONFLICT
        ]
        conflicts = ConflictChecker.audit_timetable(
            entries=entries,
            classes=self.classes,
            staff_list=self.staff_list,
            subjects=self.subjects,
            assignments=self.assignments,
            availabilities=self.availabilities,
            class_subjects=self.class_subjects,
            active_days=self.active_days,
            total_periods=8,
        )
        types = [c.conflict_type for c in conflicts]
        self.assertIn("class_double_booking", types)

    def test_teacher_unavailability_detected(self):
        """Mr. Kumar is unavailable on Monday Period 3."""
        entries = [
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Monday", "period": 3},  # CONFLICT
        ]
        conflicts = ConflictChecker.audit_timetable(
            entries=entries,
            classes=self.classes,
            staff_list=self.staff_list,
            subjects=self.subjects,
            assignments=self.assignments,
            availabilities=self.availabilities,
            class_subjects=self.class_subjects,
            active_days=self.active_days,
            total_periods=8,
        )
        types = [c.conflict_type for c in conflicts]
        self.assertIn("teacher_unavailable", types)

    def test_teacher_qualification_mismatch_detected(self):
        """Mr. Kumar is only qualified for Mathematics (ID 1), not Science (ID 2)."""
        entries = [
            {"staff_id": 1, "class_id": 1, "subject_id": 2, "day": "Monday", "period": 4},  # CONFLICT
        ]
        conflicts = ConflictChecker.audit_timetable(
            entries=entries,
            classes=self.classes,
            staff_list=self.staff_list,
            subjects=self.subjects,
            assignments=self.assignments,
            availabilities=self.availabilities,
            class_subjects=self.class_subjects,
            active_days=self.active_days,
            total_periods=8,
        )
        types = [c.conflict_type for c in conflicts]
        self.assertIn("qualification_mismatch", types)

    def test_teacher_daily_overload_detected(self):
        """Mr. Kumar has max 3 periods/day. 4 periods on Monday should trigger overload."""
        entries = [
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Monday", "period": 1},
            {"staff_id": 1, "class_id": 2, "subject_id": 1, "day": "Monday", "period": 2},
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Monday", "period": 4},
            {"staff_id": 1, "class_id": 2, "subject_id": 1, "day": "Monday", "period": 5},  # Exceeds max 3
        ]
        conflicts = ConflictChecker.audit_timetable(
            entries=entries,
            classes=self.classes,
            staff_list=self.staff_list,
            subjects=self.subjects,
            assignments=self.assignments,
            availabilities=self.availabilities,
            class_subjects=self.class_subjects,
            active_days=self.active_days,
            total_periods=8,
        )
        types = [c.conflict_type for c in conflicts]
        self.assertIn("daily_overload", types)

    def test_lunch_and_break_overlaps_detected(self):
        """No classes can be scheduled during designated Lunch period (e.g. Period 5)."""
        entries = [
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Monday", "period": 5},
        ]
        conflicts = ConflictChecker.audit_timetable(
            entries=entries,
            classes=self.classes,
            staff_list=self.staff_list,
            subjects=self.subjects,
            assignments=self.assignments,
            availabilities=self.availabilities,
            class_subjects=self.class_subjects,
            active_days=self.active_days,
            total_periods=8,
            lunch_period=5,
            break_periods=[3],
        )
        types = [c.conflict_type for c in conflicts]
        self.assertIn("lunch_overlap", types)


    def test_teacher_weekly_overload_detected(self):
        """Mr. Kumar has max 10 periods/week. 11 periods should trigger weekly overload."""
        entries = [
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Monday", "period": p}
            for p in range(1, 4)
        ] + [
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Tuesday", "period": p}
            for p in range(1, 4)
        ] + [
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Wednesday", "period": p}
            for p in range(1, 4)
        ] + [
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Thursday", "period": 1},
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Thursday", "period": 2}, # 11th period!
        ]
        conflicts = ConflictChecker.audit_timetable(
            entries=entries,
            classes=self.classes,
            staff_list=self.staff_list,
            subjects=self.subjects,
            assignments=self.assignments,
            availabilities=self.availabilities,
            class_subjects=self.class_subjects,
            active_days=["Monday", "Tuesday", "Wednesday", "Thursday"],
            total_periods=8,
        )
        types = [c.conflict_type for c in conflicts]
        self.assertIn("weekly_overload", types)

    def test_missing_subject_periods_detected(self):
        """8-A requires 2 periods of Science, but none are scheduled."""
        entries = [
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Monday", "period": 1},
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Tuesday", "period": 1},
            {"staff_id": 1, "class_id": 2, "subject_id": 1, "day": "Monday", "period": 2},
            {"staff_id": 1, "class_id": 2, "subject_id": 1, "day": "Tuesday", "period": 2},
        ]
        conflicts = ConflictChecker.audit_timetable(
            entries=entries,
            classes=self.classes,
            staff_list=self.staff_list,
            subjects=self.subjects,
            assignments=self.assignments,
            availabilities=self.availabilities,
            class_subjects=self.class_subjects,
            active_days=self.active_days,
            total_periods=8,
        )
        types = [c.conflict_type for c in conflicts]
        self.assertIn("missing_subject_periods", types)

    def test_extra_subject_periods_detected(self):
        """8-A requires 2 periods of Mathematics, but 3 are scheduled."""
        entries = [
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Monday", "period": 1},
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Tuesday", "period": 1},
            {"staff_id": 1, "class_id": 1, "subject_id": 1, "day": "Wednesday", "period": 1}, # Extra!
        ]
        conflicts = ConflictChecker.audit_timetable(
            entries=entries,
            classes=self.classes,
            staff_list=self.staff_list,
            subjects=self.subjects,
            assignments=self.assignments,
            availabilities=self.availabilities,
            class_subjects=self.class_subjects,
            active_days=["Monday", "Tuesday", "Wednesday"],
            total_periods=8,
        )
        types = [c.conflict_type for c in conflicts]
        self.assertIn("extra_subject_periods", types)


if __name__ == "__main__":
    unittest.main()
