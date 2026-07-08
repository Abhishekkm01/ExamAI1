import { useEffect, useState } from "react";
import { fetchDepartments } from "../data/apiData";

export function useDepartments() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartments()
      .then((depts) => setDepartments(depts))
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  }, []);

  return { departments, loading, defaultDepartment: departments[0] || "" };
}
