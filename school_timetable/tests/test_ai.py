"""
Unit tests for Groq AI prompt parser and fallback parser.
"""

import unittest
from app.services.groq_service import GroqService


class TestGroqService(unittest.TestCase):
    def setUp(self):
        self.service = GroqService()

    def test_fallback_rule_parser_extracts_teacher_and_classes(self):
        prompt = "Mr. Kumar teaches Mathematics for 8-A and 9-A. He is not available Monday period 3."
        result = self.service.parse_instruction(prompt)

        self.assertTrue(result["success"])
        data = result["data"]
        self.assertEqual(data["staff_name"], "Mr. Kumar")
        self.assertEqual(data["subject_name"], "Mathematics")
        self.assertIn("8-A", data["class_names"])
        self.assertIn("9-A", data["class_names"])

        unavail = data["unavailable"]
        self.assertEqual(len(unavail), 1)
        self.assertEqual(unavail[0]["day"], "Monday")
        self.assertEqual(unavail[0]["period"], 3)

    def test_explain_conflict_fallback(self):
        conflict = {
            "conflict_type": "teacher_double_booking",
            "day": "Monday",
            "period": 3,
            "staff_name": "Mr. Kumar",
            "class_name": "8-A, 9-A",
            "subject_name": "Mathematics",
        }
        explanation = self.service.explain_conflict(conflict)
        self.assertIn("Mr. Kumar", explanation)
        self.assertIn("double booking", explanation.lower())


if __name__ == "__main__":
    unittest.main()
