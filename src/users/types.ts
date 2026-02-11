export interface User {
  id: number;
  telegramId: string;
  displayName: string;
  username: string | null;
  householdId: string;
  role: "admin" | "member";
  onboardingState: "preferences" | "tour" | "recipes" | "tour_only" | "complete";
  createdAt: number;
  updatedAt: number;
}

export interface Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
}

export interface CreateUserParams {
  telegramId: string;
  displayName: string;
  username: string | null;
  householdId: string;
  role: "admin" | "member";
  onboardingState: "preferences" | "tour" | "recipes" | "tour_only" | "complete";
}
