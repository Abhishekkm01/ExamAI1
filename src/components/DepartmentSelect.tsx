import { Select } from "./Layout";

type Props = {
  value: string;
  onChange: (value: string) => void;
  departments: string[];
  loading?: boolean;
  className?: string;
  placeholder?: string;
};

export function DepartmentSelect({
  value,
  onChange,
  departments,
  loading,
  className,
  placeholder = "Select department",
}: Props) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={loading || departments.length === 0}
    >
      {!value && <option value="">{loading ? "Loading departments…" : placeholder}</option>}
      {departments.map((d) => (
        <option key={d} value={d}>{d}</option>
      ))}
    </Select>
  );
}
