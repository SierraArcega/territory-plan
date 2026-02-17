"use client";

import type { DistrictDetail } from "@/lib/api";
import DemographicsChart from "@/components/panel/DemographicsChart";
import StudentPopulations from "@/components/panel/StudentPopulations";
import AcademicMetrics from "@/components/panel/AcademicMetrics";
import FinanceData from "@/components/panel/FinanceData";
import StaffingSalaries from "@/components/panel/StaffingSalaries";

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
