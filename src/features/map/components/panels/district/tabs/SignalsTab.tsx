"use client";

import type { DistrictDetail } from "@/lib/api";
import EnrollmentCard from "../EnrollmentCard";
import StaffingCard from "../StaffingCard";
import StudentPopulationsCard from "../StudentPopulationsCard";
import AcademicCard from "../AcademicCard";
import FinanceCard from "../FinanceCard";

interface SignalsTabProps {
  data: DistrictDetail;
  leaid: string;
}

export default function SignalsTab({ data }: SignalsTabProps) {
  return (
    <div className="p-3 space-y-3">
      <EnrollmentCard
        district={data.district}
        demographics={data.enrollmentDemographics}
        trends={data.trends}
      />

      <StaffingCard
        educationData={data.educationData}
        trends={data.trends}
      />

      <StudentPopulationsCard
        district={data.district}
        educationData={data.educationData}
        trends={data.trends}
      />

      <AcademicCard
        educationData={data.educationData}
        trends={data.trends}
      />

      <FinanceCard
        educationData={data.educationData}
        trends={data.trends}
      />
    </div>
  );
}
