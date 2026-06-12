import { CloudSun, Moon, Sun, Sunset } from "lucide-react";

const dosePeriods = [
  {
    key: "morning",
    label: "Morning",
    icon: Sun,
    style: "border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    key: "afternoon",
    label: "Afternoon",
    icon: CloudSun,
    style: "border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    key: "evening",
    label: "Evening",
    icon: Sunset,
    style: "border-orange-200 bg-orange-50 text-orange-800",
  },
  {
    key: "bedtime",
    label: "Bedtime",
    icon: Moon,
    style: "border-indigo-200 bg-indigo-50 text-indigo-800",
  },
];

export default dosePeriods;
