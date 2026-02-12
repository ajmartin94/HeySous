export interface InviteToken {
  id: number;
  token: string;
  householdId: string;
  inviteType: "household" | "independent";
  createdBy: string;
  redeemedBy: string | null;
  redeemedAt: number | null;
  expiresAt: number;
  createdAt: number;
}

export interface CreateInviteParams {
  token: string;
  householdId: string;
  inviteType: "household" | "independent";
  createdBy: string;
  expiresAt: number;
}
