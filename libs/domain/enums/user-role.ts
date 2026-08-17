/** The owner administers the household; members see their own data. */
export const USER_ROLES = ["owner", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];
