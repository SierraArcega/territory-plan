import { describe, it, expect } from "vitest";
import { categorize } from "../categorizer";

describe("categorize", () => {
  describe("SPED roles", () => {
    it('categorizes "Special Education Teacher" as SPED', () => {
      expect(categorize("Special Education Teacher")).toBe("SPED");
    });

    it('categorizes "SPED Teacher" as SPED', () => {
      expect(categorize("SPED Teacher")).toBe("SPED");
    });

    it('categorizes "Resource Room Teacher" as SPED', () => {
      expect(categorize("Resource Room Teacher")).toBe("SPED");
    });

    it('categorizes "Self-Contained Classroom Teacher" as SPED', () => {
      expect(categorize("Self-Contained Classroom Teacher")).toBe("SPED");
    });

    it('categorizes "Inclusion Teacher" as SPED', () => {
      expect(categorize("Inclusion Teacher")).toBe("SPED");
    });
  });

  describe("ELL roles", () => {
    it('categorizes "ELL Teacher" as ELL', () => {
      expect(categorize("ELL Teacher")).toBe("ELL");
    });

    it('categorizes "ESL Instructor" as ELL', () => {
      expect(categorize("ESL Instructor")).toBe("ELL");
    });

    it('categorizes "Bilingual Education Teacher" as ELL', () => {
      expect(categorize("Bilingual Education Teacher")).toBe("ELL");
    });

    it('categorizes "Dual Language Teacher" as ELL', () => {
      expect(categorize("Dual Language Teacher")).toBe("ELL");
    });

    it('categorizes "English Learner Specialist" as ELL', () => {
      expect(categorize("English Learner Specialist")).toBe("ELL");
    });
  });

  describe("Admin roles", () => {
    it('categorizes "Principal" as Admin', () => {
      expect(categorize("Principal")).toBe("Admin");
    });

    it('categorizes "Assistant Principal" as Admin', () => {
      expect(categorize("Assistant Principal")).toBe("Admin");
    });

    it('categorizes "Superintendent" as Admin', () => {
      expect(categorize("Superintendent")).toBe("Admin");
    });

    it('categorizes "Director of Curriculum" as Admin', () => {
      expect(categorize("Director of Curriculum")).toBe("Admin");
    });

    it('categorizes "District Coordinator" as Admin', () => {
      expect(categorize("District Coordinator")).toBe("Admin");
    });

    it('categorizes "Dean of Students" as Admin', () => {
      expect(categorize("Dean of Students")).toBe("Admin");
    });
  });

  describe("Specialist roles", () => {
    it('categorizes "Reading Specialist" as Specialist', () => {
      expect(categorize("Reading Specialist")).toBe("Specialist");
    });

    it('categorizes "Math Specialist" as Specialist', () => {
      expect(categorize("Math Specialist")).toBe("Specialist");
    });

    it('categorizes "Interventionist" as Specialist', () => {
      expect(categorize("Interventionist")).toBe("Specialist");
    });

    it('categorizes "Instructional Coach" as Specialist', () => {
      expect(categorize("Instructional Coach")).toBe("Specialist");
    });
  });

  describe("Counseling roles", () => {
    it('categorizes "School Counselor" as Counseling', () => {
      expect(categorize("School Counselor")).toBe("Counseling");
    });

    it('categorizes "School Psychologist" as Counseling', () => {
      expect(categorize("School Psychologist")).toBe("Counseling");
    });

    it('categorizes "Social Worker" as Counseling', () => {
      expect(categorize("Social Worker")).toBe("Counseling");
    });

    it('categorizes "Mental Health Counselor" as Counseling', () => {
      expect(categorize("Mental Health Counselor")).toBe("Counseling");
    });
  });

  describe("Related Services roles", () => {
    it('categorizes "Speech Language Pathologist" as Related Services', () => {
      expect(categorize("Speech Language Pathologist")).toBe("Related Services");
    });

    it('categorizes "SLP" as Related Services', () => {
      expect(categorize("SLP")).toBe("Related Services");
    });

    it('categorizes "Occupational Therapist" as Related Services', () => {
      expect(categorize("Occupational Therapist")).toBe("Related Services");
    });

    it('categorizes "Physical Therapist" as Related Services', () => {
      expect(categorize("Physical Therapist")).toBe("Related Services");
    });
  });

  describe("General Ed fallback", () => {
    it('categorizes "Math Teacher" as General Ed', () => {
      expect(categorize("Math Teacher")).toBe("General Ed");
    });

    it('categorizes "5th Grade Teacher" as General Ed', () => {
      expect(categorize("5th Grade Teacher")).toBe("General Ed");
    });

    it('categorizes "High School English Teacher" as General Ed', () => {
      expect(categorize("High School English Teacher")).toBe("General Ed");
    });

    it('categorizes "Classroom Teacher" as General Ed', () => {
      expect(categorize("Classroom Teacher")).toBe("General Ed");
    });
  });

  describe("Other fallback", () => {
    it('categorizes "Custodian" as Other', () => {
      expect(categorize("Custodian")).toBe("Other");
    });

    it('categorizes "Bus Driver" as Other', () => {
      expect(categorize("Bus Driver")).toBe("Other");
    });

    it('categorizes "Secretary" as Other', () => {
      expect(categorize("Secretary")).toBe("Other");
    });

    it('categorizes "Cafeteria Worker" as Other', () => {
      expect(categorize("Cafeteria Worker")).toBe("Other");
    });
  });

  describe("case insensitivity", () => {
    it("matches regardless of case", () => {
      expect(categorize("SPECIAL EDUCATION TEACHER")).toBe("SPED");
      expect(categorize("special education teacher")).toBe("SPED");
      expect(categorize("SpEcIaL eDuCaTiOn TeAcHeR")).toBe("SPED");
    });

    it("matches ELL keywords case-insensitively", () => {
      expect(categorize("ell teacher")).toBe("ELL");
      expect(categorize("ELL TEACHER")).toBe("ELL");
    });

    it("matches teacher fallback case-insensitively", () => {
      expect(categorize("MATH TEACHER")).toBe("General Ed");
      expect(categorize("math teacher")).toBe("General Ed");
    });
  });

  describe("priority ordering", () => {
    it("matches SPED before General Ed when title contains both keywords", () => {
      expect(categorize("Special Education Teacher")).toBe("SPED");
    });

    it("matches ELL before General Ed for bilingual teacher", () => {
      expect(categorize("Bilingual Teacher")).toBe("ELL");
    });
  });
});
