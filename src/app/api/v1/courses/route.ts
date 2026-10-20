import { licensedCourses } from "@/lib/distributors";
import { courseJson, json, withDistributor } from "../_shared";

export const GET = withDistributor(async (distributor) => {
  const rows = await licensedCourses(distributor.id);
  return json({ courses: rows.map((row) => courseJson(row.course, row.lessonCount, row.totalDurationSeconds)) });
});
