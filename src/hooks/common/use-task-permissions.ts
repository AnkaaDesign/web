import { SECTOR_PRIVILEGES } from '@/constants';
import { usePrivileges } from './use-privileges';

/**
 * Centralized task permission hook.
 * Replaces scattered inline privilege checks (isFinancialUser, isWarehouseUser, etc.)
 * with descriptive, self-documenting permission flags.
 *
 * Usage:
 *   const { canViewQuote, canEditIdentity, canViewCuts } = useTaskPermissions();
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
  const isProductionManager = is(SECTOR_PRIVILEGES.PRODUCTION_MANAGER);
  const isPlotting = is(SECTOR_PRIVILEGES.PLOTTING);
  const isCommercial = is(SECTOR_PRIVILEGES.COMMERCIAL);
  const isProduction = is(SECTOR_PRIVILEGES.PRODUCTION);

  // -- CRUD ---------------------------------------------------------------
  const canCreate = hasAnyPrivilegeAccess([
    SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  ]);
  const canEdit = hasAnyPrivilegeAccess([
    SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  ]);
  const canDelete = isAdmin;
  const canBatchOperate = isAdmin;

  // -- Status management --------------------------------------------------
  const canManageStatus = isAdmin || isTeamLeader;
  // Keep in lockstep with `canFinishTask` (entity-permissions): LOGISTIC was granted finish in the
  // 2026-06-25 logistics-finish change. (This flag had drifted stale here; the task detail/prep/
  // context-menus all use `canFinishTask` directly, which already includes LOGISTIC.)
  const canFinish = hasAnyPrivilegeAccess([
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    SECTOR_PRIVILEGES.LOGISTIC,
  ]);
  const canCancel = hasAnyPrivilegeAccess([
    SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    SECTOR_PRIVILEGES.COMMERCIAL,
  ]);

  // -- Section visibility (edit form & detail page) -----------------------
  const canViewQuote = isAdmin || isFinancial || isCommercial;
  const canViewRestrictedFields = isAdmin || isFinancial || isCommercial || isLogistic || isProductionManager || isDesigner;
  const canViewBonification = isAdmin || isFinancial || isCommercial || isProduction;
  const canViewDates = !isWarehouse;
  const canViewServices = !isWarehouse && !isPlotting;
  const canViewLayout = isAdmin || isLogistic || isProductionManager || (isProduction && isTeamLeader);
  const canViewTruckSpot = isAdmin || isLogistic || isProductionManager;
  const canViewPaint = !isWarehouse && !isFinancial && !isLogistic && !isProductionManager;
  const canViewLogoPaint = canViewPaint && !isCommercial;
  const canViewCuts = !isFinancial && !isLogistic && !isProductionManager && !isCommercial;
  const canViewAirbrushing = !isWarehouse && !isFinancial && !isDesigner && !isLogistic && !isProductionManager && !isCommercial;
  const canViewBaseFiles = !isWarehouse && !isFinancial;
  const canViewProjectFiles = !isWarehouse && !isFinancial;
  const canViewCheckinCheckout = isAdmin || isLogistic || isProductionManager;
  const canViewReimbursement = !isWarehouse && !isFinancial && !isLogistic && !isProductionManager;
  const canViewObservation = !isWarehouse && !isFinancial && !isDesigner && !isLogistic && !isProductionManager && !isCommercial;
  // PRODUCTION can VIEW the observation section but must not edit it (API rejects observation writes from PRODUCTION)
  const canEditObservation = canViewObservation && !isProduction;
  const canViewArtworkBadges = isAdmin || isCommercial || isFinancial || isLogistic || isProductionManager || isDesigner;
  const canViewDocuments = isAdmin || isFinancial;

  // -- Field editability (controls disabled state) ------------------------
  // These return true when the user CAN edit (negate for disabled prop)
  const canEditIdentity = !isFinancial && !isWarehouse && !isDesigner;
  const canEditSector = !isFinancial && !isWarehouse && !isDesigner && !isCommercial;
  const canEditBonification = !isFinancial && !isDesigner && !isLogistic && !isProductionManager && !isWarehouse;
  const canEditDates = !isWarehouse && !isFinancial && !isDesigner;
  const canEditResponsibles = !isFinancial && !isDesigner && !isLogistic && !isProductionManager;
  const canEditServices = !isWarehouse;
  const canEditLayout = !isFinancial && !isDesigner;
  const canEditPaint = !isWarehouse && !isDesigner;
  // Plan-cut add/remove in the task form maps to POST /cuts + DELETE /cuts/batch,
  // which the API restricts to DESIGNER/ADMIN. Everyone else views cuts read-only.
  const canEditCuts = isAdmin || isDesigner;

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
    canViewQuote,
    canViewRestrictedFields,
    canViewBonification,
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
    canEditObservation,
    canViewArtworkBadges,
    canViewDocuments,

    // Field editability
    canEditIdentity,
    canEditSector,
    canEditBonification,
    canEditDates,
    canEditResponsibles,
    canEditServices,
    canEditLayout,
    canEditPaint,
    canEditCuts,
  };
}

export type TaskPermissions = ReturnType<typeof useTaskPermissions>;
