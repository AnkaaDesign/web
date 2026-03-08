import { SECTOR_PRIVILEGES } from '@/constants';
import { usePrivileges } from './use-privileges';

/**
 * Centralized task permission hook.
 * Replaces scattered inline privilege checks (isFinancialUser, isWarehouseUser, etc.)
 * with descriptive, self-documenting permission flags.
 *
 * Usage:
 *   const { canViewPricing, canEditIdentity, canViewCuts } = useTaskPermissions();
 */
export function useTaskPermissions() {
  const {
    user,
    isAdmin,
    isTeamLeader,
    hasAnyPrivilegeAccess,
  } = usePrivileges();

  const privilege = user?.sector?.privileges as SECTOR_PRIVILEGES | undefined;

  // Sector shorthand — EXACT match only (not hierarchical).
  // hasPrivilegeAccess() treats ADMIN as matching every privilege, which breaks
  // the negation-based flags below (e.g. !isFinancial would be false for ADMIN).
  const is = (p: SECTOR_PRIVILEGES) => privilege === p;
  const isFinancial = is(SECTOR_PRIVILEGES.FINANCIAL);
  const isWarehouse = is(SECTOR_PRIVILEGES.WAREHOUSE);
  const isDesigner = is(SECTOR_PRIVILEGES.DESIGNER);
  const isLogistic = is(SECTOR_PRIVILEGES.LOGISTIC);
  const isPlotting = is(SECTOR_PRIVILEGES.PLOTTING);
  const isCommercial = is(SECTOR_PRIVILEGES.COMMERCIAL);
  const isProduction = is(SECTOR_PRIVILEGES.PRODUCTION);

  // -- CRUD ---------------------------------------------------------------
  const canCreate = hasAnyPrivilegeAccess([
    SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC,
  ]);
  const canEdit = hasAnyPrivilegeAccess([
    SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.LOGISTIC,
  ]);
  const canDelete = isAdmin;
  const canBatchOperate = isAdmin;

  // -- Status management --------------------------------------------------
  const canManageStatus = isAdmin || isTeamLeader;
  const canFinish = hasAnyPrivilegeAccess([SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.LOGISTIC]);
  const canCancel = hasAnyPrivilegeAccess([
    SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.COMMERCIAL,
  ]);

  // -- Section visibility (edit form & detail page) -----------------------
  const canViewPricing = isAdmin || isFinancial || isCommercial;
  const canViewRestrictedFields = isAdmin || isFinancial || isCommercial || isLogistic || isDesigner;
  const canViewCommission = isAdmin || isFinancial || isCommercial || isProduction;
  const canViewDates = !isWarehouse;
  const canViewServices = !isWarehouse && !isPlotting;
  const canViewLayout = isAdmin || isLogistic || (isProduction && isTeamLeader);
  const canViewTruckSpot = isAdmin || isLogistic;
  const canViewPaint = !isWarehouse && !isFinancial && !isLogistic;
  const canViewLogoPaint = canViewPaint && !isCommercial;
  const canViewCuts = !isFinancial && !isLogistic && !isCommercial;
  const canViewAirbrushing = !isWarehouse && !isFinancial && !isDesigner && !isLogistic && !isCommercial;
  const canViewBaseFiles = !isWarehouse && !isFinancial;
  const canViewProjectFiles = !isWarehouse && !isFinancial;
  const canViewCheckinCheckout = isAdmin || isLogistic;
  const canViewReimbursement = !isWarehouse && !isFinancial && !isLogistic;
  const canViewObservation = !isWarehouse && !isFinancial && !isDesigner && !isLogistic && !isCommercial;
  const canViewArtworkBadges = isAdmin || isCommercial || isFinancial || isLogistic || isDesigner;
  const canViewDocuments = isAdmin || isFinancial;

  // -- Field editability (controls disabled state) ------------------------
  // These return true when the user CAN edit (negate for disabled prop)
  const canEditIdentity = !isFinancial && !isWarehouse && !isDesigner;
  const canEditSector = !isFinancial && !isWarehouse && !isDesigner && !isCommercial;
  const canEditCommission = !isFinancial && !isDesigner && !isLogistic && !isWarehouse;
  const canEditDates = !isWarehouse && !isFinancial && !isDesigner;
  const canEditResponsibles = !isFinancial && !isDesigner && !isLogistic;
  const canEditServices = !isWarehouse;
  const canEditLayout = !isFinancial && !isDesigner;
  const canEditPaint = !isWarehouse && !isDesigner;

  return {
    // User info
    user,
    privilege,
    isAdmin,
    isTeamLeader,

    // CRUD
    canCreate,
    canEdit,
    canDelete,
    canBatchOperate,

    // Status
    canManageStatus,
    canFinish,
    canCancel,

    // Section visibility
    canViewPricing,
    canViewRestrictedFields,
    canViewCommission,
    canViewDates,
    canViewServices,
    canViewLayout,
    canViewTruckSpot,
    canViewPaint,
    canViewLogoPaint,
    canViewCuts,
    canViewAirbrushing,
    canViewBaseFiles,
    canViewProjectFiles,
    canViewCheckinCheckout,
    canViewReimbursement,
    canViewObservation,
    canViewArtworkBadges,
    canViewDocuments,

    // Field editability
    canEditIdentity,
    canEditSector,
    canEditCommission,
    canEditDates,
    canEditResponsibles,
    canEditServices,
    canEditLayout,
    canEditPaint,
  };
}

export type TaskPermissions = ReturnType<typeof useTaskPermissions>;
