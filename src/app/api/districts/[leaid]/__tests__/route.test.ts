import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    district: {
      findUnique: vi.fn().mockResolvedValue({
        leaid: "1234567",
        name: "Test ISD",
        stateAbbrev: "TX",
        stateFips: "48",
        enrollment: 1000,
        lograde: "PK",
        higrade: "12",
        phone: null,
        streetLocation: null,
        cityLocation: "Austin",
        zipLocation: "78701",
        countyName: "Travis",
        urbanCentricLocale: null,
        numberOfSchools: 5,
        specEdStudents: null,
        ellStudents: null,
        websiteUrl: null,
        jobBoardUrl: null,
        accountType: "district",
        isCustomer: null,
        hasOpenPipeline: null,
        accountName: null,
        lmsid: null,
        notes: null,
        ownerId: null,
        notesUpdatedAt: null,
        enrollmentTrend3yr: null,
        staffingTrend3yr: null,
        graduationTrend3yr: null,
        financeDataYear: null,
        staffDataYear: null,
        saipeDataYear: null,
        graduationDataYear: null,
        demographicsDataYear: null,
        salesExecutiveUser: null,
        ownerUser: null,
        districtTags: [],
        contacts: [],
        territoryPlans: [],
        districtFinancials: [],
        totalRevenue: null, federalRevenue: null, stateRevenue: null,
        localRevenue: null, totalExpenditure: null, expenditurePerPupil: null,
        childrenPovertyCount: null, childrenPovertyPercent: null,
        medianHouseholdIncome: null, graduationRateTotal: null,
        salariesTotal: null, salariesInstruction: null,
        salariesTeachersRegular: null, salariesTeachersSpecialEd: null,
        salariesTeachersVocational: null, salariesTeachersOther: null,
        salariesSupportAdmin: null, salariesSupportInstructional: null,
        benefitsTotal: null, teachersFte: null, teachersElementaryFte: null,
        teachersSecondaryFte: null, adminFte: null, guidanceCounselorsFte: null,
        instructionalAidesFte: null, supportStaffFte: null, staffTotalFte: null,
        chronicAbsenteeismCount: null, chronicAbsenteeismRate: null,
        absenteeismDataYear: null, enrollmentWhite: null, enrollmentBlack: null,
        enrollmentHispanic: null, enrollmentAsian: null,
        enrollmentAmericanIndian: null, enrollmentPacificIslander: null,
        enrollmentTwoOrMore: null, totalEnrollment: null,
        swdPct: null, ellPct: null, studentTeacherRatio: null,
        studentStaffRatio: null, spedStudentTeacherRatio: null,
        vacancyPressureSignal: null, swdTrend3yr: null, ellTrend3yr: null,
        absenteeismTrend3yr: null, studentTeacherRatioTrend3yr: null,
        mathProficiencyTrend3yr: null, readProficiencyTrend3yr: null,
        expenditurePpTrend3yr: null, absenteeismVsState: null,
        graduationVsState: null, studentTeacherRatioVsState: null,
        swdPctVsState: null, ellPctVsState: null, mathProficiencyVsState: null,
        readProficiencyVsState: null, expenditurePpVsState: null,
        absenteeismVsNational: null, graduationVsNational: null,
        studentTeacherRatioVsNational: null, swdPctVsNational: null,
        ellPctVsNational: null, mathProficiencyVsNational: null,
        readProficiencyVsNational: null, expenditurePpVsNational: null,
        absenteeismQuartileState: null, graduationQuartileState: null,
        studentTeacherRatioQuartileState: null, swdPctQuartileState: null,
        ellPctQuartileState: null, mathProficiencyQuartileState: null,
        readProficiencyQuartileState: null, expenditurePpQuartileState: null,
      }),
      $queryRaw: vi.fn().mockResolvedValue([{ lat: 30.2, lng: -97.7 }]),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ lat: 30.2, lng: -97.7 }]),
    school: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

// Mock getChildren
vi.mock("@/features/districts/lib/rollup", () => ({
  getChildren: vi.fn().mockResolvedValue([]),
}));

import { getChildren } from "@/features/districts/lib/rollup";
import prisma from "@/lib/prisma";

describe("GET /api/districts/[leaid]", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns district data with correct shape", async () => {
    const req = new NextRequest("http://localhost/api/districts/1234567");
    const res = await GET(req, { params: Promise.resolve({ leaid: "1234567" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.district.leaid).toBe("1234567");
    expect(body.district.name).toBe("Test ISD");
    expect(body.district.isRollup).toBe(false);
    expect(body.contacts).toEqual([]);
    expect(body.tags).toEqual([]);
  });

  it("calls centroid query and getChildren — both are invoked", async () => {
    const req = new NextRequest("http://localhost/api/districts/1234567");
    await GET(req, { params: Promise.resolve({ leaid: "1234567" }) });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(getChildren).toHaveBeenCalledWith("1234567");
  });
});
