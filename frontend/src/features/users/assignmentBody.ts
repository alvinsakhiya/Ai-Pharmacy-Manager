import type { AssignMembershipBody } from "./usersApi";

interface AssignmentDraft {
  role: string;
  isGlobalRequester: boolean;
  ownPharmacyId?: number;
  groupId?: string;
  pharmacyId?: string;
  pharmacyIds?: string[];
}

export function buildAssignMembershipBody({
  role,
  isGlobalRequester,
  ownPharmacyId,
  groupId,
  pharmacyId,
  pharmacyIds = [],
}: AssignmentDraft): AssignMembershipBody {
  if (role === "ADMIN") {
    return { role };
  }

  if (role === "SUPERINTENDENT") {
    return { role, group_id: Number(groupId) };
  }

  if (role === "STOCK_EMPLOYEE") {
    return {
      role,
      group_id: Number(groupId),
      pharmacy_ids: pharmacyIds.map(Number),
    };
  }

  if (isGlobalRequester) {
    return { role, pharmacy_id: Number(pharmacyId) };
  }

  return { role, pharmacy_id: Number(ownPharmacyId) };
}
