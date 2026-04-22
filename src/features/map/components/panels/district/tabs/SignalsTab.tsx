"use client";

import type { DistrictDetail } from "@/lib/api";
import EnrollmentCard from "../EnrollmentCard";
import StaffingCard from "../StaffingCard";
import StudentPopulationsCard from "../StudentPopulationsCard";
import AcademicCard from "../AcademicCard";
import FinanceCard from "../FinanceCard";
import { NewsSection } from "@/features/news/components/NewsSection";

interface SignalsTabProps {
  data: DistrictDetail;
  leaid: string;
}

export default function SignalsTab({ data, leaid }: SignalsTabProps) {
  return (
    <div className="p-3 space-y-3">
      <NewsSection leaid={leaid} />

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
