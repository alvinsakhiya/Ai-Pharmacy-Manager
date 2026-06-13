export const careSettingOptions = [
  ["COMMUNITY", "Community"],
  ["CARE_HOME", "Care home"],
  ["OTHER", "Other"],
];

export function getCareSettingLabel(value) {
  return (
    careSettingOptions.find(([optionValue]) => optionValue === value)?.[1]
    || "Other"
  );
}
