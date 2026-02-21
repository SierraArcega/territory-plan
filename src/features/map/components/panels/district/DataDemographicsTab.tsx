"use client";

import type { DistrictDetail } from "@/lib/api";
import DemographicsChart from "@/features/districts/components/DemographicsChart";
import StudentPopulations from "@/features/districts/components/StudentPopulations";
import AcademicMetrics from "@/features/districts/components/AcademicMetrics";
import FinanceData from "@/features/districts/components/FinanceData";
import StaffingSalaries from "@/features/districts/components/StaffingSalaries";

interface DataDemographicsTabProps {
  data: DistrictDetail;
}

export default function DataDemographicsTab({ data }: DataDemographicsTabProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {data.enrollmentDemographics && (
        <DemographicsChart demographics={data.enrollmentDemographics} />
      )}

      <StudentPopulations
        district={data.district}
        educationData={data.educationData}
      />

      {data.educationData && (
        <AcademicMetrics educationData={data.educationData} />
      )}

      {data.educationData && (
        <FinanceData educationData={data.educationData} />
      )}

      {data.educationData && (
        <StaffingSalaries educationData={data.educationData} />
      )}
    </div>
  );
}
