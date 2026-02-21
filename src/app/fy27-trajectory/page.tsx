import { fetchTrajectoryData } from "./queries";
import Dashboard from "@/components/fy27-trajectory/Dashboard";

export default async function FY27TrajectoryPage() {
  const data = await fetchTrajectoryData();
  return <Dashboard data={data} />;
}
