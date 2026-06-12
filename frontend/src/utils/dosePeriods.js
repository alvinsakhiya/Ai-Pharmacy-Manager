import { CloudSun, Moon, Sun, Sunset } from "lucide-react";

const dosePeriods = [
  {
    key: "morning",
    label: "Morning",
    code: "AM",
    icon: Sun,
    style: "dose-morning border-amber-300 bg-amber-50 text-amber-950",
  },
  {
    key: "afternoon",
    label: "Afternoon",
    code: "PM",
    icon: CloudSun,
    style: "dose-afternoon border-sky-300 bg-sky-50 text-sky-950",
  },
  {
    key: "evening",
    label: "Evening",
    code: "EVE",
    icon: Sunset,
    style: "dose-evening border-violet-300 bg-violet-50 text-violet-950",
  },
  {
    key: "bedtime",
    label: "Bedtime",
    code: "HS",
    icon: Moon,
    style: "dose-bedtime border-slate-400 bg-slate-100 text-slate-950",
  },
];

export default dosePeriods;
