import type { User } from "../types";
import { USER_STATUS, SECTOR_PRIVILEGES, TEAM_LEADER } from "../constants";
import { dateUtils } from "./date";

/**
 * Get user status color
 */
export function getUserStatusColor(status: USER_STATUS): string {
  const colors: Record<USER_STATUS, string> = {
    [USER_STATUS.EXPERIENCE_PERIOD_1]: "orange",
    [USER_STATUS.EXPERIENCE_PERIOD_2]: "orange",
    [USER_STATUS.EFFECTED]: "green",
    [USER_STATUS.DISMISSED]: "gray",
  };
  return colors[status] || "default";
}

/**
 * Check if user is active (not dismissed)
 */
export function isUserActive(user: User): boolean {
  return user.status !== USER_STATUS.DISMISSED && user.verified === true && user.password !== null;
}

/**
 * Check if user is dismissed
 */
export function isUserInactive(user: User): boolean {
  return user.status === USER_STATUS.DISMISSED;
}

/**
 * Check if user is blocked
 */
export function isUserBlocked(user: User): boolean {
  return user.status === USER_STATUS.DISMISSED;
}

/**
 * Check if user has specific privilege
 * Uses EXACT privilege matching (not hierarchical) - ADMIN is special case with access to everything
 * FINANCIAL can edit tasks but not inventory, WAREHOUSE can edit inventory but not tasks
 * TEAM_LEADER is a virtual privilege that checks user.managedSector relation (only sector managers)
 *
 * @param user - The user to check
 * @param requiredPrivilege - Either a SECTOR_PRIVILEGES enum value or the TEAM_LEADER constant
 * @returns true if user has the required privilege, false otherwise
 */
export function hasPrivilege(user: User, requiredPrivilege: SECTOR_PRIVILEGES | typeof TEAM_LEADER): boolean {
  // Handle TEAM_LEADER virtual privilege - check if user manages a sector
  if (requiredPrivilege === TEAM_LEADER) {
    return isTeamLeader(user);
  }

  if (!user.sector?.privileges) return false;

  const userPrivilege = user.sector.privileges;

  // ADMIN has access to everything (special case)
  if (userPrivilege === SECTOR_PRIVILEGES.ADMIN) return true;

  // For all other privileges, require EXACT match (no hierarchy)
  return userPrivilege === requiredPrivilege;
}

/**
 * Check if user has ANY of the specified privileges (OR logic)
 * Matches backend @Roles decorator behavior - checks if user's privilege is IN the array
 * ADMIN can access everything, others need exact match
 * TEAM_LEADER is a virtual privilege that checks user.managedSector relation (only sector managers)
 *
 * @param user - The user to check
 * @param requiredPrivileges - Array of SECTOR_PRIVILEGES values and/or TEAM_LEADER constant
 * @returns true if user has any of the required privileges, false otherwise
 */
export function hasAnyPrivilege(user: User, requiredPrivileges: (SECTOR_PRIVILEGES | typeof TEAM_LEADER)[]): boolean {
  if (!requiredPrivileges.length) return false;

  // Check for TEAM_LEADER virtual privilege first
  if (requiredPrivileges.includes(TEAM_LEADER) && isTeamLeader(user)) {
    return true;
  }

  if (!user.sector?.privileges) return false;

  const userPrivilege = user.sector.privileges;

  // ADMIN has access to everything (special case)
  if (userPrivilege === SECTOR_PRIVILEGES.ADMIN) return true;

  // Check if user's privilege is in the allowed array (exact match)
  return requiredPrivileges.includes(userPrivilege);
}

/**
 * Check if user has ALL of the specified privileges (AND logic)
 * User must have EXACT match for all privileges or be ADMIN
 * Note: Since users can only have ONE privilege, this will only return true if:
 * 1. User is ADMIN (has access to all), OR
 * 2. Only one privilege is required and user has that exact privilege
 */
export function hasAllPrivileges(user: User, requiredPrivileges: SECTOR_PRIVILEGES[]): boolean {
  if (!user.sector?.privileges || !requiredPrivileges.length) return false;

  return requiredPrivileges.every((privilege) => hasPrivilege(user, privilege));
}

/**
 * Check if user can access based on privilege array (same as hasAnyPrivilege)
 * Alias function that matches backend controller terminology
 */
export function canAccessWithPrivileges(user: User, allowedPrivileges: SECTOR_PRIVILEGES[]): boolean {
  return hasAnyPrivilege(user, allowedPrivileges);
}

/**
 * Check if user is administrator
 */
export function isUserAdmin(user: User): boolean {
  return hasPrivilege(user, SECTOR_PRIVILEGES.ADMIN);
}

/**
 * Check if user has HR-level privileges or higher
 * Note: LEADER privilege was removed - use isTeamLeader() to check if user manages a sector
 */
export function isUserLeader(user: User): boolean {
  return hasPrivilege(user, SECTOR_PRIVILEGES.HUMAN_RESOURCES);
}

/**
 * Get user display name
 */
export function getUserDisplayName(user: User): string {
  return user.name || user.email || "Usuário desconhecido";
}

/**
 * Get user initials
 */
export function getUserInitials(user: User): string {
  const name = user.name || user.email || "";
  const parts = name.split(" ");

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

/**
 * Format user info
 */
export function formatUserInfo(user: User): string {
  const name = user.name || "Sem nome";
  const email = user.email;
  const position = user.position?.name || "Sem cargo";

  return `${name} (${email}) - ${position}`;
}

/**
 * Get user age in days
 */
export function getUserAge(user: User): number {
  return dateUtils.getDaysAgo(user.createdAt);
}

/**
 * Check if user is new (created within last 30 days)
 */
export function isNewUser(user: User, daysThreshold: number = 30): boolean {
  return getUserAge(user) <= daysThreshold;
}

/**
 * Group users by status
 */
export function groupUsersByStatus(users: User[]): Record<USER_STATUS, User[]> {
  const groups = {
    [USER_STATUS.EXPERIENCE_PERIOD_1]: [],
    [USER_STATUS.EXPERIENCE_PERIOD_2]: [],
    [USER_STATUS.EFFECTED]: [],
    [USER_STATUS.DISMISSED]: [],
  } as Record<USER_STATUS, User[]>;

  users.forEach((user) => {
    if (groups[user.status]) {
      groups[user.status].push(user);
    }
  });

  return groups;
}

/**
 * Group users by sector
 */
export function groupUsersBySector(users: User[]): Record<string, User[]> {
  return users.reduce(
    (groups, user) => {
      const sectorName = user.sector?.name || "Sem setor";
      if (!groups[sectorName]) {
        groups[sectorName] = [];
      }
      groups[sectorName].push(user);
      return groups;
    },
    {} as Record<string, User[]>,
  );
}

/**
 * Filter active users
 */
export function filterActiveUsers(users: User[]): User[] {
  return users.filter(isUserActive);
}

/**
 * Sort users by name
 */
export function sortUsersByName(users: User[], order: "asc" | "desc" = "asc"): User[] {
  return [...users].sort((a, b) => {
    const nameA = a.name || a.email || "";
    const nameB = b.name || b.email || "";
    return order === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
  });
}

/**
 * Calculate user statistics
 */
export function calculateUserStats(users: User[]) {
  const total = users.length;
  const active = users.filter(isUserActive).length;
  const inactive = users.filter(isUserInactive).length;
  const verified = users.filter((user) => user.verified).length;
  const newUsers = users.filter((user) => isNewUser(user)).length;

  const bySector = groupUsersBySector(users);
  const sectorCounts = Object.entries(bySector).reduce(
    (acc, [sector, userList]) => {
      acc[sector] = userList.length;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    total,
    active,
    inactive,
    verified,
    newUsers,
    sectorCounts,
  };
}

// =====================
// Team Leadership Utilities
// =====================

/**
 * Check if user is a team leader (manages a sector)
 * Note: This now checks the managedSector relation (Sector.managerId points to this user)
 */
export function isTeamLeader(user: User): boolean {
  return Boolean(user.managedSector?.id);
}

/**
 * Get the sector ID that the user manages (if any)
 */
export function getManagedSectorId(user: User): string | null {
  return user.managedSector?.id || null;
}

/**
 * Check if user can manage another user (is their team leader)
 */
export function canManageUser(manager: User, targetUser: User): boolean {
  const managedSectorId = getManagedSectorId(manager);
  if (!managedSectorId) {
    return false;
  }

  // Manager can manage users in the sector they manage
  return targetUser.sectorId === managedSectorId;
}

/**
 * Get users that a leader manages (team members)
 */
export function getTeamMembers(leader: User, allUsers: User[]): User[] {
  const managedSectorId = getManagedSectorId(leader);
  if (!managedSectorId) {
    return [];
  }

  return allUsers.filter((user) => user.sectorId === managedSectorId);
}

/**
 * Get users from the same sector as the given user
 */
export function getUsersInSameSector(user: User, allUsers: User[]): User[] {
  if (!user.sectorId) {
    return [];
  }

  return allUsers.filter((u) => u.sectorId === user.sectorId && u.id !== user.id);
}

/**
 * Check if user has both sector membership and leadership privileges
 */
export function isUserLeaderWithPrivileges(user: User): boolean {
  return isUserLeader(user) && isTeamLeader(user);
}

/**
 * Get sector object that user manages (if any)
 * Note: This returns the full sector object from the managedSector relation
 */
export function getManagedSector(user: User): User["managedSector"] | null {
  return user.managedSector || null;
}

/**
 * Check if user can access team management features
 */
export function canAccessTeamManagement(user: User): boolean {
  // User must be a sector manager OR have admin privileges
  return isUserAdmin(user) || isTeamLeader(user);
}

// =====================
// Bonus Eligibility Utilities
// =====================

/**
 * Check if user is eligible for bonus calculation based on:
 * 1. user.status === EFFECTED (not in experience period or dismissed)
 * 2. user.performanceLevel > 0
 * 3. position.bonifiable === true
 */
export function isUserEligibleForBonus(user: User): boolean {
  // Check if user is EFFECTED (not in experience period or dismissed)
  if (user.status !== USER_STATUS.EFFECTED) {
    return false;
  }

  // Check if user has performance level > 0
  if (!user.performanceLevel || user.performanceLevel <= 0) {
    return false;
  }

  // Check if user's position is bonifiable
  if (!user.position?.bonifiable) {
    return false;
  }

  return true;
}

/**
 * Get bonus eligibility reason for a user
 * Returns null if user is eligible, or a reason string if not eligible
 */
export function getBonusIneligibilityReason(user: User): string | null {
  if (user.status === USER_STATUS.DISMISSED) {
    return "Usuário está desligado";
  }

  if (!user.performanceLevel || user.performanceLevel <= 0) {
    return "Nível de performance deve ser maior que 0";
  }

  if (!user.position) {
    return "Usuário não possui cargo definido";
  }

  if (!user.position.bonifiable) {
    return "Cargo não é elegível para bonificação";
  }

  return null;
}

/**
 * Filter users eligible for bonus calculation
 */
export function filterBonusEligibleUsers(users: User[]): User[] {
  return users.filter(isUserEligibleForBonus);
}

/**
 * Group users by bonus eligibility
 */
export function groupUsersByBonusEligibility(users: User[]): { eligible: User[]; ineligible: User[] } {
  const eligible: User[] = [];
  const ineligible: User[] = [];

  users.forEach((user) => {
    if (isUserEligibleForBonus(user)) {
      eligible.push(user);
    } else {
      ineligible.push(user);
    }
  });

  return { eligible, ineligible };
}

/**
 * Calculate bonus eligibility statistics for a list of users
 */
export function calculateBonusEligibilityStats(users: User[]) {
  const total = users.length;
  const eligible = users.filter(isUserEligibleForBonus).length;
  const ineligible = total - eligible;

  // Count reasons for ineligibility
  const ineligibilityReasons: Record<string, number> = {};
  users.forEach((user) => {
    const reason = getBonusIneligibilityReason(user);
    if (reason) {
      ineligibilityReasons[reason] = (ineligibilityReasons[reason] || 0) + 1;
    }
  });

  return {
    total,
    eligible,
    ineligible,
    eligibilityRate: total > 0 ? (eligible / total) * 100 : 0,
    ineligibilityReasons,
  };
}

// =====================
// Status Time Tracking Utilities
// =====================

/**
 * Calculate days remaining for experience period status
 * Returns null if status is not an experience period or if end date is not set
 */
export function getDaysRemainingInExperiencePeriod(user: User): number | null {
  const now = new Date();

  if (user.status === USER_STATUS.EXPERIENCE_PERIOD_1 && user.exp1EndAt) {
    const endDate = new Date(user.exp1EndAt);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  if (user.status === USER_STATUS.EXPERIENCE_PERIOD_2 && user.exp2EndAt) {
    const endDate = new Date(user.exp2EndAt);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  return null;
}

/**
 * Calculate time since contracted or dismissed
 * Returns an object with years, months, and days
 * Returns null if the status date is in the future (not yet reached)
 */
export function getTimeSinceStatusChange(user: User): { years: number; months: number; days: number } | null {
  const now = new Date();
  let startDate: Date | null = null;

  if (user.status === USER_STATUS.EFFECTED && user.effectedAt) {
    startDate = new Date(user.effectedAt);
  } else if (user.status === USER_STATUS.DISMISSED && user.dismissedAt) {
    startDate = new Date(user.dismissedAt);
  }

  if (!startDate) {
    return null;
  }

  // If the status date is in the future, return null (can't calculate time since a future date)
  if (startDate > now) {
    return null;
  }

  let years = now.getFullYear() - startDate.getFullYear();
  let months = now.getMonth() - startDate.getMonth();
  let days = now.getDate() - startDate.getDate();

  // Adjust for negative days
  if (days < 0) {
    months--;
    const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += lastMonth.getDate();
  }

  // Adjust for negative months
  if (months < 0) {
    years--;
    months += 12;
  }

  return { years, months, days };
}

/**
 * Format time since status change as a human-readable string
 */
export function formatTimeSinceStatusChange(user: User): string | null {
  const time = getTimeSinceStatusChange(user);

  if (!time) {
    return null;
  }

  const parts: string[] = [];

  if (time.years > 0) {
    parts.push(`${time.years} ${time.years === 1 ? 'ano' : 'anos'}`);
  }

  if (time.months > 0) {
    parts.push(`${time.months} ${time.months === 1 ? 'mês' : 'meses'}`);
  }

  if (time.days > 0 || parts.length === 0) {
    parts.push(`${time.days} ${time.days === 1 ? 'dia' : 'dias'}`);
  }

  return parts.join(', ');
}

/**
 * Format time since status change in compact YY:MM:DD format
 */
export function formatTimeSinceStatusChangeCompact(user: User): string | null {
  const time = getTimeSinceStatusChange(user);

  if (!time) {
    return null;
  }

  // Format as YY:MM:DD with zero-padding
  const years = String(time.years).padStart(2, '0');
  const months = String(time.months).padStart(2, '0');
  const days = String(time.days).padStart(2, '0');

  return `${years}:${months}:${days}`;
}

/**
 * Calculate days since experience period started
 * For exp1: days since exp1StartAt
 * For exp2: (exp1 duration) + (days into exp2)
 *   - exp1 duration is calculated from exp1StartAt to exp1EndAt (or exp2StartAt if exp1EndAt not available)
 *   - if neither is available, assumes standard 45 days for exp1
 *   - days into exp2 is calculated from exp2StartAt (or exp1EndAt) to now
 */
export function getDaysSinceExperienceStart(user: User): number | null {
  const now = new Date();

  if (user.status === USER_STATUS.EXPERIENCE_PERIOD_1 && user.exp1StartAt) {
    const startDate = new Date(user.exp1StartAt);
    const diffTime = now.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  }

  if (user.status === USER_STATUS.EXPERIENCE_PERIOD_2) {
    let exp1Duration = 45; // Default to 45 days if we can't calculate
    let exp2Start: Date | null = null;

    // Calculate exp1 duration if we have the dates
    if (user.exp1StartAt && user.exp1EndAt) {
      const exp1StartDate = new Date(user.exp1StartAt);
      const exp1EndDate = new Date(user.exp1EndAt);
      exp1Duration = Math.floor((exp1EndDate.getTime() - exp1StartDate.getTime()) / (1000 * 60 * 60 * 24));
      exp2Start = exp1EndDate;
    } else if (user.exp1StartAt && user.exp2StartAt) {
      // If exp1EndAt not available, use exp2StartAt
      const exp1StartDate = new Date(user.exp1StartAt);
      const exp2StartDate = new Date(user.exp2StartAt);
      exp1Duration = Math.floor((exp2StartDate.getTime() - exp1StartDate.getTime()) / (1000 * 60 * 60 * 24));
      exp2Start = exp2StartDate;
    } else if (user.exp2StartAt) {
      // Only exp2StartAt available, use it with default exp1 duration
      exp2Start = new Date(user.exp2StartAt);
    } else if (user.exp1EndAt) {
      // Only exp1EndAt available, use it with default exp1 duration
      exp2Start = new Date(user.exp1EndAt);
    }

    // Calculate days into exp2
    let daysIntoExp2 = 0;
    if (exp2Start) {
      const diffTime = now.getTime() - exp2Start.getTime();
      daysIntoExp2 = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      daysIntoExp2 = daysIntoExp2 >= 0 ? daysIntoExp2 : 0;
    }

    return exp1Duration + daysIntoExp2;
  }

  return null;
}

/**
 * Get status badge text with time information
 */
export function getUserStatusBadgeText(user: User): string {
  const statusLabels: Record<USER_STATUS, string> = {
    [USER_STATUS.EXPERIENCE_PERIOD_1]: "Experiencia 1",
    [USER_STATUS.EXPERIENCE_PERIOD_2]: "Experiencia 2",
    [USER_STATUS.EFFECTED]: "Efetivado",
    [USER_STATUS.DISMISSED]: "Demitido",
  };

  const baseLabel = statusLabels[user.status] || user.status;

  // For experience periods, show days since start (just the number)
  const daysSinceStart = getDaysSinceExperienceStart(user);
  if (daysSinceStart !== null) {
    return `${baseLabel} - ${daysSinceStart}`;
  }

  // For contracted/dismissed, show time since status change in compact format
  const timeSince = formatTimeSinceStatusChangeCompact(user);
  if (timeSince) {
    return `${baseLabel} - ${timeSince}`;
  }

  return baseLabel;
}

/**
 * Check if experience period is about to expire (within 7 days)
 */
export function isExperiencePeriodExpiringSoon(user: User, daysThreshold: number = 7): boolean {
  const daysRemaining = getDaysRemainingInExperiencePeriod(user);
  return daysRemaining !== null && daysRemaining <= daysThreshold && daysRemaining > 0;
}

/**
 * Check if experience period has expired
 */
export function isExperiencePeriodExpired(user: User): boolean {
  const daysRemaining = getDaysRemainingInExperiencePeriod(user);
  return daysRemaining !== null && daysRemaining === 0;
}
