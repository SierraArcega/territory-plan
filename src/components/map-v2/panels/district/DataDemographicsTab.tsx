"use client";

import type { DistrictDetail } from "@/lib/api";
import DemographicsChart from "./DemographicsChart";
import StudentPopulations from "./StudentPopulations";
import AcademicMetrics from "./AcademicMetrics";
import FinanceData from "./FinanceData";
import StaffingSalaries from "./StaffingSalaries";

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
