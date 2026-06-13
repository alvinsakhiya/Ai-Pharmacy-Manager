import { Building2, Home, MapPin } from "lucide-react";
import Badge from "./Badge";
import { getCareSettingLabel } from "../utils/careSettings";

const careSettingConfig = {
  COMMUNITY: { icon: Home, tone: "blue" },
  CARE_HOME: { icon: Building2, tone: "purple" },
  OTHER: { icon: MapPin, tone: "slate" },
};

function CareSettingBadge({ label, value }) {
  const config = careSettingConfig[value] || careSettingConfig.OTHER;

  return (
    <Badge icon={config.icon} tone={config.tone}>
      {label || getCareSettingLabel(value)}
    </Badge>
  );
}

export default CareSettingBadge;
