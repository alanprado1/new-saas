"use client";

import { use } from "react";
import LevelDashboard from "../LevelDashboard";

export default function LevelDashboardPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = use(params);
  return <LevelDashboard level={level} />;
}
