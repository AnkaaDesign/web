import { Suspense, useEffect } from "react";
// Use the retry-wrapped lazy so a stale-chunk import after a deploy reloads to
// the fresh build instead of blanking the page. All `lazy(() => import(...))`
// call sites below are unchanged.
import { lazyWithRetry as lazy } from "@/lib/lazy-with-retry";
import { ErrorBoundary } from "@/components/navigation/error-boundary";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { routes } from "./constants";
import { ThemeProvider } from "@/contexts/theme-context";
import { AuthProvider } from "@/contexts/auth-context";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { PricingProvider, PricingVisibilityBoundary } from "@/contexts/pricing-context";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { FileViewerProvider } from "@/components/common/file/file-viewer";
import { MessageModalProvider } from "@/components/common/message-modal";
import { AutoPrivilegeRoute } from "@/components/navigation/auto-privilege-route";
import { DeepLinkRedirect } from "@/components/navigation/deep-link-redirect";
import { MobileUsageGuard } from "@/components/navigation/mobile-usage-guard";
import { MainLayout } from "@/layouts/main-layout";
import { AuthLayout } from "@/layouts/auth-layout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setupWebNotifications } from "@/lib/setup-notifications";
import { PushNotificationSetup } from "@/components/common/push-notification-setup";
import { SocketNotificationsListener } from "@/components/common/socket-notifications-listener";
import { SpotlightSearch } from "@/components/navigation/spotlight";
import { SocketReconnectHandler } from "@/components/common/socket-reconnect-handler";
import { useAppVersion } from "@/hooks/use-app-version";

function AppVersionChecker() {
  useAppVersion();
  return null;
}

// Loading component for lazy loading
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

// Auth pages (loaded immediately)
import { NotFound } from "@/pages/not-found";
import { LoginPage } from "@/pages/authentication/login";
import { RegisterPage } from "@/pages/authentication/register";
import { RecoverPasswordPage } from "@/pages/authentication/recover-password";
import { VerifyCodePage } from "@/pages/authentication/verify-code";
import { ResetPasswordTokenPage as ResetPasswordPage } from "@/pages/authentication/reset-password/[token]";
import { VerifyPasswordResetPage } from "@/pages/authentication/verify-password-reset";

// Lazy load all other pages
// Home
const HomePage = lazy(() => import("@/pages/home").then((module) => ({ default: module.HomePage })));

// Hidden auto-running tutorial — public, no auth, for screen-recording demos. Delete file when done.
const DashboardDemoPage = lazy(() => import("@/pages/dashboard-demo").then((module) => ({ default: module.DashboardDemoPage })));
const DataTableDemoPage = lazy(() => import("@/pages/data-table-demo").then((module) => ({ default: module.DataTableDemoPage })));
const DetailPageDemoPage = lazy(() => import("@/pages/detail-page-demo/[id]").then((module) => ({ default: module.DetailPageDemoPage })));

// Favorites
const FavoritesPage = lazy(() => import("@/pages/favorites").then((module) => ({ default: module.FavoritesPage })));

// Profile
const ProfilePage = lazy(() => import("@/pages/profile").then((module) => ({ default: module.ProfilePage })));
const NotificationPreferencesPage = lazy(() => import("@/pages/profile/notification-preferences").then((module) => ({ default: module.NotificationPreferencesPage })));

// Test Notification Workflow
const TestNotificationWorkflow = lazy(() => import("@/pages/test-notification-workflow"));

// Administration
const Administration = lazy(() => import("@/pages/administration/root").then((module) => ({ default: module.AdministrationRootPage })));

// Responsibles
const ResponsiblesList = lazy(() => import("@/pages/responsibles/index"));
const ResponsiblesNew = lazy(() => import("@/pages/responsibles/new"));
const ResponsiblesDetails = lazy(() => import("@/pages/responsibles/details/[id]"));
const ResponsiblesEdit = lazy(() => import("@/pages/responsibles/[id]/edit"));
const ResponsiblesPassword = lazy(() => import("@/pages/responsibles/[id]/password"));

// Financial
const FinancialRoot = lazy(() => import("@/pages/financial/root").then((module) => ({ default: module.FinancialRootPage })));
const FinancialCustomersList = lazy(() => import("@/pages/financial/customers/list").then((module) => ({ default: module.FinancialCustomersListPage })));
const FinancialCustomersDetails = lazy(() => import("@/pages/financial/customers/details/[id]").then((module) => ({ default: module.FinancialCustomersDetailsPage })));
const FinancialCustomersEdit = lazy(() => import("@/pages/financial/customers/edit/[id]").then((module) => ({ default: module.FinancialCustomersEditPage })));
const FinancialBilling = lazy(() => import("@/pages/financial/billing/list").then((module) => ({ default: module.BillingPage })));
const FinancialBillingDetail = lazy(() => import("@/pages/financial/billing/details/[id]").then((module) => ({ default: module.BillingDetailPage })));
const FinancialBillingDocumentPreview = lazy(() => import("@/pages/financial/billing/document-preview").then((module) => ({ default: module.BillingDocumentPreviewPage })));
const FinancialBudgetList = lazy(() => import("@/pages/financial/budget/list").then((module) => ({ default: module.BudgetListPage })));
const FinancialBudgetCreate = lazy(() => import("@/pages/financial/budget/create").then((module) => ({ default: module.FinancialBudgetCreatePage })));
const FinancialBudgetDetail = lazy(() => import("@/pages/financial/budget/details/[taskId]").then((module) => ({ default: module.FinancialBudgetDetailPage })));
const FinancialNotasFiscais = lazy(() => import("@/pages/financial/notas-fiscais/list").then((module) => ({ default: module.NotasFiscaisPage })));
const FinancialNfseDetail = lazy(() => import("@/pages/financial/nfse/detail").then((module) => ({ default: module.NfseDetailPage })));
const ReconciliationTransactionDetail = lazy(() => import("@/pages/financial/reconciliation/transaction-detail").then((module) => ({ default: module.ReconciliationTransactionDetailPage })));
const ReconciliationFiscalDocumentDetail = lazy(() => import("@/pages/financial/reconciliation/fiscal-document-detail").then((module) => ({ default: module.ReconciliationFiscalDocumentDetailPage })));
const ReconciliationCategoriesList = lazy(() => import("@/pages/financial/reconciliation/categories-list").then((module) => ({ default: module.ReconciliationCategoriesListPage })));
const ReconciliationStatement = lazy(() => import("@/pages/financial/reconciliation/statement").then((module) => ({ default: module.ReconciliationStatementPage })));
const ReconciliationStatistics = lazy(() => import("@/pages/financial/statistics/reconciliation").then((module) => ({ default: module.ReconciliationStatisticsPage })));
const AccountsPayableListPage = lazy(() => import("@/pages/financial/accounts-payable/list"));
const ReceivablesListPage = lazy(() => import("@/pages/financial/receivables/list"));
const RecurrentPayablesListPage = lazy(() => import("@/pages/financial/recurrent-payables/list"));
const CreateRecurrentPayablePage = lazy(() => import("@/pages/financial/recurrent-payables/create"));
const EditRecurrentPayablePage = lazy(() => import("@/pages/financial/recurrent-payables/edit/[id]"));
const FinancialCustomersCreate = lazy(() => import("@/pages/administration/customers/create").then((module) => ({ default: module.CreateCustomerPage })));
const FinancialCustomersBatchEdit = lazy(() => import("@/pages/administration/customers/batch-edit").then((module) => ({ default: module.CustomerBatchEditPage })));

const AdministrationCollaboratorsList = lazy(() => import("@/pages/administration/collaborators/list").then((module) => ({ default: module.default })));
const AdministrationCollaboratorsCreate = lazy(() => import("@/pages/administration/collaborators/create").then((module) => ({ default: module.default })));
const AdministrationCollaboratorsEdit = lazy(() => import("@/pages/administration/collaborators/edit/[id]").then((module) => ({ default: module.default })));
const AdministrationCollaboratorsDetails = lazy(() => import("@/pages/administration/collaborators/details/[id]").then((module) => ({ default: module.default })));
const AdministrationCollaboratorsBatchEdit = lazy(() => import("@/pages/administration/collaborators/batch-edit").then((module) => ({ default: module.default })));


const PersonnelDepartmentPayrollList = lazy(() => import("@/pages/personnel-department/payroll/list").then((module) => ({ default: module.default })));
const PersonnelDepartmentPayrollDetail = lazy(() => import("@/pages/personnel-department/payroll/detail").then((module) => ({ default: module.default })));
const PersonnelDepartmentBonusList = lazy(() => import("@/pages/personnel-department/bonus/list").then((module) => ({ default: module.default })));
const PersonnelDepartmentBonusDetail = lazy(() => import("@/pages/personnel-department/bonus/detail").then((module) => ({ default: module.default })));
const PersonnelDepartmentBonusSimulation = lazy(() => import("@/pages/personnel-department/simulacao-bonus").then((module) => ({ default: module.default })));

// Personnel Department - Salários e Cargos (W3A)
const PersonnelDepartmentLoansList = lazy(() => import("@/pages/personnel-department/loans/list").then((module) => ({ default: module.LoanListPage })));
const PersonnelDepartmentSalaryAdjustmentsList = lazy(() => import("@/pages/personnel-department/salary-adjustments/list").then((module) => ({ default: module.SalaryAdjustmentListPage })));
const PersonnelDepartmentSalaryAdjustmentDetails = lazy(() => import("@/pages/personnel-department/salary-adjustments/details/[id]").then((module) => ({ default: module.SalaryAdjustmentDetailPage })));
const PersonnelDepartmentPromotionsList = lazy(() => import("@/pages/personnel-department/promotions/list").then((module) => ({ default: module.PromotionListPage })));
const PersonnelDepartmentPromotionsSimulation = lazy(() => import("@/pages/personnel-department/simulacao-promocoes").then((module) => ({ default: module.default })));
const PersonnelDepartmentPromotionDetails = lazy(() => import("@/pages/personnel-department/promotions/details/[id]").then((module) => ({ default: module.PromotionDetailPage })));

// Personnel Department - Admissões + Rescisões (W3B)
const PersonnelDepartmentAdmissionsList = lazy(() => import("@/pages/personnel-department/admissions/list"));
const PersonnelDepartmentAdmissionsCreate = lazy(() => import("@/pages/personnel-department/admissions/create").then((module) => ({ default: module.AdmissionCreatePage })));
const PersonnelDepartmentAdmissionsEdit = lazy(() => import("@/pages/personnel-department/admissions/edit/[id]").then((module) => ({ default: module.AdmissionEditPage })));
const PersonnelDepartmentAdmissionsDetails = lazy(() => import("@/pages/personnel-department/admissions/details/[id]").then((module) => ({ default: module.AdmissionDetailPage })));
const PersonnelDepartmentTerminationsList = lazy(() => import("@/pages/personnel-department/terminations/list"));
const PersonnelDepartmentTerminationsCreate = lazy(() => import("@/pages/personnel-department/terminations/create").then((module) => ({ default: module.TerminationCreatePage })));
const PersonnelDepartmentTerminationsEdit = lazy(() => import("@/pages/personnel-department/terminations/edit/[id]").then((module) => ({ default: module.TerminationEditPage })));
const PersonnelDepartmentTerminationsDetails = lazy(() => import("@/pages/personnel-department/terminations/details/[id]").then((module) => ({ default: module.TerminationDetailPage })));

// Personnel Department - Férias (Área Andressa)
const PersonnelDepartmentVacationsList = lazy(() => import("@/pages/personnel-department/vacations/list"));
const PersonnelDepartmentVacationsCreate = lazy(() => import("@/pages/personnel-department/vacations/create").then((module) => ({ default: module.VacationCreatePage })));
const PersonnelDepartmentVacationsDetails = lazy(() => import("@/pages/personnel-department/vacations/details/[id]").then((module) => ({ default: module.VacationDetailPage })));
const PersonnelDepartmentVacationsEdit = lazy(() => import("@/pages/personnel-department/vacations/edit/[id]").then((module) => ({ default: module.VacationEditPage })));

// Occupational Health - Medicina do Trabalho (W3C)
const OccupationalHealthMedicalExamsList = lazy(() => import("@/pages/occupational-health/medical-exams/list").then((module) => ({ default: module.MedicalExamListPage })));
const OccupationalHealthMedicalExamsCreate = lazy(() => import("@/pages/occupational-health/medical-exams/create").then((module) => ({ default: module.MedicalExamCreatePage })));
const OccupationalHealthMedicalExamsEdit = lazy(() => import("@/pages/occupational-health/medical-exams/edit/[id]").then((module) => ({ default: module.MedicalExamEditPage })));
const OccupationalHealthMedicalExamsDetails = lazy(() => import("@/pages/occupational-health/medical-exams/details/[id]").then((module) => ({ default: module.MedicalExamDetailPage })));
const OccupationalHealthPeriodicExams = lazy(() => import("@/pages/occupational-health/periodic-exams/list").then((module) => ({ default: module.PeriodicExamsPage })));
const OccupationalHealthFispqList = lazy(() => import("@/pages/occupational-health/fispq/list").then((module) => ({ default: module.FispqPage })));
const OccupationalHealthFispqCreate = lazy(() => import("@/pages/occupational-health/fispq/create").then((module) => ({ default: module.FispqCreatePage })));
const OccupationalHealthFispqEdit = lazy(() => import("@/pages/occupational-health/fispq/edit/[id]").then((module) => ({ default: module.FispqEditPage })));
const OccupationalHealthFispqDetails = lazy(() => import("@/pages/occupational-health/fispq/details/[id]").then((module) => ({ default: module.FispqDetailPage })));
const OccupationalHealthLeavesList = lazy(() => import("@/pages/occupational-health/leaves/list").then((module) => ({ default: module.LeaveListPage })));
const OccupationalHealthLeavesCreate = lazy(() => import("@/pages/occupational-health/leaves/create").then((module) => ({ default: module.LeaveCreatePage })));
const OccupationalHealthLeavesEdit = lazy(() => import("@/pages/occupational-health/leaves/edit/[id]").then((module) => ({ default: module.LeaveEditPage })));
const OccupationalHealthLeavesDetails = lazy(() => import("@/pages/occupational-health/leaves/details/[id]").then((module) => ({ default: module.LeaveDetailPage })));

// Occupational Health - CAT / Acidentes de Trabalho (Área Andressa)
const OccupationalHealthWorkAccidentsList = lazy(() => import("@/pages/occupational-health/work-accidents/list").then((module) => ({ default: module.WorkAccidentListPage })));
const OccupationalHealthWorkAccidentsCreate = lazy(() => import("@/pages/occupational-health/work-accidents/create").then((module) => ({ default: module.WorkAccidentCreatePage })));
const OccupationalHealthWorkAccidentsDetails = lazy(() => import("@/pages/occupational-health/work-accidents/details/[id]").then((module) => ({ default: module.WorkAccidentDetailPage })));
const OccupationalHealthWorkAccidentsEdit = lazy(() => import("@/pages/occupational-health/work-accidents/edit/[id]").then((module) => ({ default: module.WorkAccidentEditPage })));

// Personnel Department - Benefícios / Adesões (W3C)
const PersonnelDepartmentBenefitsList = lazy(() => import("@/pages/personnel-department/benefits/list").then((module) => ({ default: module.BenefitListPage })));
const PersonnelDepartmentBenefitsCreate = lazy(() => import("@/pages/personnel-department/benefits/create").then((module) => ({ default: module.BenefitCreatePage })));
const PersonnelDepartmentBenefitsEdit = lazy(() => import("@/pages/personnel-department/benefits/edit/[id]").then((module) => ({ default: module.BenefitEditPage })));
const PersonnelDepartmentBenefitsDetails = lazy(() => import("@/pages/personnel-department/benefits/details/[id]").then((module) => ({ default: module.BenefitDetailPage })));
const PersonnelDepartmentBenefitEnrollmentsList = lazy(() => import("@/pages/personnel-department/benefits/enrollments/list").then((module) => ({ default: module.UserBenefitListPage })));
const PersonnelDepartmentBenefitEnrollmentsCreate = lazy(() => import("@/pages/personnel-department/benefits/enrollments/create").then((module) => ({ default: module.UserBenefitCreatePage })));
const PersonnelDepartmentBenefitEnrollmentsEdit = lazy(() => import("@/pages/personnel-department/benefits/enrollments/edit/[id]").then((module) => ({ default: module.UserBenefitEditPage })));
const PersonnelDepartmentBenefitEnrollmentsDetails = lazy(() => import("@/pages/personnel-department/benefits/enrollments/details/[id]").then((module) => ({ default: module.UserBenefitDetailPage })));

const AdministrationSectorsList = lazy(() => import("@/pages/administration/sectors/list").then((module) => ({ default: module.SectorListPage })));
const AdministrationSectorsCreate = lazy(() => import("@/pages/administration/sectors/create").then((module) => ({ default: module.SectorCreatePage })));
const AdministrationSectorsEdit = lazy(() => import("@/pages/administration/sectors/edit/[id]").then((module) => ({ default: module.SectorEditPage })));
const AdministrationSectorsDetails = lazy(() => import("@/pages/administration/sectors/details/[id]").then((module) => ({ default: module.SectorDetailPage })));
const AdministrationSectorsBatchEdit = lazy(() => import("@/pages/administration/sectors/batch-edit").then((module) => ({ default: module.SectorBatchEditPage })));
const AdministrationGoalsList = lazy(() => import("@/pages/administration/goals").then((module) => ({ default: module.GoalListPage })));
const AppDistributionPage = lazy(() => import("@/pages/administration/app-distribution").then((module) => ({ default: module.AppDistributionPage })));

const AdministrationNotifications = lazy(() => import("@/pages/administration/notifications/list").then((module) => ({ default: module.NotificationListPage })));
const AdministrationNotificationsEdit = lazy(() => import("@/pages/administration/notifications/edit/[id]").then((module) => ({ default: module.EditNotificationPage })));
const AdministrationNotificationsDetails = lazy(() => import("@/pages/administration/notifications/details/[id]").then((module) => ({ default: module.NotificationDetailsPage })));
const AdministrationNotificationsSend = lazy(() => import("@/pages/administration/notifications/create").then((module) => ({ default: module.CreateNotificationPage })));

// Notification Configurations
const AdministrationNotificationConfigurationsList = lazy(() => import("@/pages/administration/notifications/configurations/list").then((module) => ({ default: module.NotificationConfigurationListPage })));
const AdministrationNotificationConfigurationsDetails = lazy(() => import("@/pages/administration/notifications/configurations/details").then((module) => ({ default: module.NotificationConfigurationDetailsPage })));
const AdministrationNotificationConfigurationsCreate = lazy(() => import("@/pages/administration/notifications/configurations/create").then((module) => ({ default: module.NotificationConfigurationCreatePage })));
const AdministrationNotificationConfigurationsEdit = lazy(() => import("@/pages/administration/notifications/configurations/edit").then((module) => ({ default: module.NotificationConfigurationEditPage })));
const AdministrationNotificationConfigurationsTest = lazy(() => import("@/pages/administration/notifications/configurations/test").then((module) => ({ default: module.NotificationConfigurationTestPage })));

const AdministrationMessages = lazy(() => import("@/pages/administration/messages/list").then((module) => ({ default: module.MessageListPage })));
const AdministrationMessagesCreate = lazy(() => import("@/pages/administration/messages/create").then((module) => ({ default: module.CreateMessagePage })));
const AdministrationMessagesDetails = lazy(() => import("@/pages/administration/messages/details/[id]").then((module) => ({ default: module.MessageDetailsPage })));
const AdministrationMessagesEdit = lazy(() => import("@/pages/administration/messages/edit/[id]").then((module) => ({ default: module.EditMessagePage })));

const AdministrationChangeLogs = lazy(() => import("@/pages/administration/change-logs/list").then((module) => ({ default: module.default })));
const AdministrationChangeLogsDetails = lazy(() => import("@/pages/administration/change-logs/details/[id]").then((module) => ({ default: module.ChangeLogDetails })));

// Under Construction Page
const UnderConstruction = lazy(() => import("@/pages/under-construction"));

// Public Pages (no authentication required)
const PublicBudgetPage = lazy(() => import("@/pages/public/budget/[id]").then((module) => ({ default: module.PublicBudgetPage })));

// Public app-install landing page (no auth, no providers)
const InstallPage = lazy(() => import("@/pages/install").then((module) => ({ default: module.InstallPage })));
const PublicServiceReportPage = lazy(() => import("@/pages/public/service-report/[id]").then((module) => ({ default: module.PublicServiceReportPage })));
const PublicWasteCertificatePage = lazy(() => import("@/pages/public/waste-certificate/[id]").then((module) => ({ default: module.PublicWasteCertificatePage })));
const PrivacyPolicyPage = lazy(() => import("@/pages/public/privacy-policy").then((module) => ({ default: module.PrivacyPolicyPage })));

// Inventory
const Inventory = lazy(() => import("@/pages/inventory/root").then((module) => ({ default: module.InventoryRootPage })));
const InventoryLoans = lazy(() => import("@/pages/inventory/loans/list").then((module) => ({ default: module.default })));
const InventoryLoansCreate = lazy(() => import("@/pages/inventory/loans/create").then((module) => ({ default: module.LoanCreate })));
const InventoryLoansDetails = lazy(() => import("@/pages/inventory/loans/details/[id]").then((module) => ({ default: module.LoanDetailsPage })));
const InventoryLoansBatchEdit = lazy(() => import("@/pages/inventory/loans/batch-edit").then((module) => ({ default: module.default })));
const InventoryPpe = lazy(() => import("@/pages/inventory/ppe/list").then((module) => ({ default: module.PpeListPage })));
const InventoryPpeCreate = lazy(() => import("@/pages/inventory/ppe/create").then((module) => ({ default: module.PpeCreatePage })));
const InventoryPpeEdit = lazy(() => import("@/pages/inventory/ppe/edit/[id]").then((module) => ({ default: module.EditEpiPage })));
const InventoryPpeDetails = lazy(() => import("@/pages/inventory/ppe/details/[id]").then((module) => ({ default: module.default })));
const InventoryPpeDeliveries = lazy(() => import("@/pages/inventory/ppe/deliveries/list").then((module) => ({ default: module.PpeDeliveryListPage })));
const InventoryPpeDeliveriesCreate = lazy(() => import("@/pages/inventory/ppe/deliveries/create").then((module) => ({ default: module.EPIDeliveryCreate })));
const InventoryPpeDeliveriesEdit = lazy(() => import("@/pages/inventory/ppe/deliveries/edit/[id]").then((module) => ({ default: module.EPIDeliveryEdit })));
const InventoryPpeDeliveriesDetails = lazy(() => import("@/pages/inventory/ppe/deliveries/details/[id]").then((module) => ({ default: module.EPIDeliveryDetails })));
const InventoryPpeSchedules = lazy(() => import("@/pages/inventory/ppe/schedules/list").then((module) => ({ default: module.PPESchedulesListPage })));
const InventoryPpeSchedulesCreate = lazy(() => import("@/pages/inventory/ppe/schedules/create").then((module) => ({ default: module.PPEScheduleCreatePage })));
const InventoryPpeSchedulesEdit = lazy(() => import("@/pages/inventory/ppe/schedules/edit/[id]").then((module) => ({ default: module.PPEScheduleEditPage })));
const InventoryPpeSchedulesDetails = lazy(() => import("@/pages/inventory/ppe/schedules/details/[id]").then((module) => ({ default: module.EPIScheduleDetails })));
const InventorySuppliers = lazy(() => import("@/pages/inventory/suppliers/list").then((module) => ({ default: module.SupplierListPage })));
const SuppliersCreate = lazy(() => import("@/pages/inventory/suppliers/create").then((module) => ({ default: module.default })));
const SuppliersEdit = lazy(() => import("@/pages/inventory/suppliers/edit/[id]").then((module) => ({ default: module.SupplierEditPage })));
const SuppliersDetails = lazy(() => import("@/pages/inventory/suppliers/details/[id]").then((module) => ({ default: module.default })));
const SuppliersBatchEdit = lazy(() => import("@/pages/inventory/suppliers/batch-edit").then((module) => ({ default: module.default })));
const InventoryWarehouseLocations = lazy(() => import("@/pages/inventory/warehouse-locations/list").then((module) => ({ default: module.WarehouseLocationListPage })));

// Testing pages (development only)
const InventoryMaintenance = lazy(() => import("@/pages/inventory/maintenance/list"));
const InventoryMaintenanceCreate = lazy(() => import("@/pages/inventory/maintenance/create").then((module) => ({ default: module.CreateMaintenancePage })));
const InventoryMaintenanceEdit = lazy(() => import("@/pages/inventory/maintenance/edit/[id]").then((module) => ({ default: module.EditMaintenancePage })));
const InventoryMaintenanceDetails = lazy(() => import("@/pages/inventory/maintenance/details/[id]").then((module) => ({ default: module.default })));
const InventoryMaintenanceSchedules = lazy(() => import("@/pages/inventory/maintenance/schedule").then((module) => ({ default: module.MaintenanceSchedulePage })));
const InventoryMaintenanceSchedulesCreate = lazy(() =>
  import("@/pages/inventory/maintenance/schedules/create").then((module) => ({ default: module.CreateMaintenanceSchedulePage })),
);
const InventoryMaintenanceSchedulesEdit = lazy(() =>
  import("@/pages/inventory/maintenance/schedules/edit/[id]").then((module) => ({ default: module.EditMaintenanceSchedulePage })),
);
const InventoryMaintenanceSchedulesDetails = lazy(() =>
  import("@/pages/inventory/maintenance/schedules/details/[id]").then((module) => ({ default: module.MaintenanceScheduleDetailsPage })),
);
const InventoryMovements = lazy(() => import("@/pages/inventory/movements/list").then((module) => ({ default: module.MovementsListPage })));
const InventoryMovementsCreate = lazy(() => import("@/pages/inventory/movements/create").then((module) => ({ default: module.CreateMovementPage })));
const InventoryMovementsEdit = lazy(() => import("@/pages/inventory/movements/edit/[id]").then((module) => ({ default: module.EditMovementPage })));
const InventoryMovementsDetails = lazy(() => import("@/pages/inventory/movements/details/[id]").then((module) => ({ default: module.MovementDetailsPage })));
const InventoryMovementsBatchEdit = lazy(() => import("@/pages/inventory/movements/batch-edit").then((module) => ({ default: module.default })));

// External Withdrawals
const InventoryExternalOperations = lazy(() => import("@/pages/inventory/external-operations/list").then((module) => ({ default: module.ExternalOperationListPage })));
const InventoryExternalOperationsCreate = lazy(() => import("@/pages/inventory/external-operations/create").then((module) => ({ default: module.ExternalOperationCreate })));
const InventoryExternalOperationsEdit = lazy(() => import("@/pages/inventory/external-operations/edit/[id]").then((module) => ({ default: module.ExternalOperationEditPage })));
const InventoryExternalOperationsDetails = lazy(() => import("@/pages/inventory/external-operations/details/[id]").then((module) => ({ default: module.default })));

const InventoryOrders = lazy(() => import("@/pages/inventory/orders/list").then((module) => ({ default: module.OrderListPage })));
const InventoryOrdersCreate = lazy(() => import("@/pages/inventory/orders/create").then((module) => ({ default: module.CreateOrderPage })));
const InventoryOrdersEdit = lazy(() => import("@/pages/inventory/orders/edit/[id]").then((module) => ({ default: module.EditOrderPage })));
const InventoryOrdersDetails = lazy(() => import("@/pages/inventory/orders/details/[id]").then((module) => ({ default: module.default })));
const InventoryOrdersSchedules = lazy(() => import("@/pages/inventory/orders/schedules/list").then((module) => ({ default: module.OrderScheduleListPage })));
const InventoryOrdersSchedulesCreate = lazy(() => import("@/pages/inventory/orders/schedules/create").then((module) => ({ default: module.OrderScheduleCreate })));
const InventoryOrdersSchedulesEdit = lazy(() => import("@/pages/inventory/orders/schedules/edit/[id]").then((module) => ({ default: module.OrderScheduleEditPage })));
const InventoryOrdersSchedulesDetails = lazy(() => import("@/pages/inventory/orders/schedules/details/[id]").then((module) => ({ default: module.OrderScheduleDetailsPage })));
const InventoryOrdersAutomatic = lazy(() => import("@/pages/inventory/orders/automatic/list").then((module) => ({ default: module.AutomaticOrderListPage })));
const InventoryOrdersAutomaticConfigure = lazy(() => import("@/pages/inventory/orders/automatic/configure").then((module) => ({ default: module.AutomaticOrderConfigurePage })));

const InventoryProducts = lazy(() => import("@/pages/inventory/products/list").then((module) => ({ default: module.ProductListPage })));
const InventoryProductsCreate = lazy(() => import("@/pages/inventory/products/create").then((module) => ({ default: module.CreateProductPage })));
const InventoryProductsEdit = lazy(() => import("@/pages/inventory/products/edit/[id]").then((module) => ({ default: module.EditProductPage })));
const InventoryProductsDetails = lazy(() => import("@/pages/inventory/products/details/[id]").then((module) => ({ default: module.default })));
const InventoryProductsBatchEdit = lazy(() => import("@/pages/inventory/products/batch-edit").then((module) => ({ default: module.default })));
const InventoryProductsStockBalance = lazy(() => import("@/pages/inventory/products/stock-balance").then((module) => ({ default: module.default })));
const InventoryStockBalanceCreate = lazy(() => import("@/pages/inventory/stock-balance/create").then((module) => ({ default: module.StockBalanceCreatePage })));
const InventoryProductsCategories = lazy(() => import("@/pages/inventory/products/categories/list").then((module) => ({ default: module.default })));
const InventoryProductsCategoriesCreate = lazy(() => import("@/pages/inventory/products/categories/create").then((module) => ({ default: module.default })));
const InventoryProductsCategoriesEdit = lazy(() => import("@/pages/inventory/products/categories/edit/[id]").then((module) => ({ default: module.default })));
const InventoryProductsCategoriesDetails = lazy(() => import("@/pages/inventory/products/categories/details/[id]").then((module) => ({ default: module.default })));
const InventoryProductsCategoriesBatchEdit = lazy(() => import("@/pages/inventory/products/categories/batch-edit").then((module) => ({ default: module.default })));
const InventoryProductsBrands = lazy(() => import("@/pages/inventory/products/brands/list").then((module) => ({ default: module.default })));
const InventoryProductsBrandsCreate = lazy(() => import("@/pages/inventory/products/brands/create").then((module) => ({ default: module.default })));
const InventoryProductsBrandsEdit = lazy(() => import("@/pages/inventory/products/brands/edit/[id]").then((module) => ({ default: module.default })));
const InventoryProductsBrandsDetails = lazy(() => import("@/pages/inventory/products/brands/details/[id]").then((module) => ({ default: module.default })));
const InventoryProductsBrandsBatchEdit = lazy(() => import("@/pages/inventory/products/brands/batch-edit").then((module) => ({ default: module.default })));

// Inventory Statistics
const InventoryStatistics = lazy(() => import("@/pages/inventory/statistics/index").then((module) => ({ default: module.InventoryStatisticsPage })));
const InventoryStatisticsConsumption = lazy(() => import("@/pages/inventory/statistics/consumption").then((module) => ({ default: module.InventoryConsumptionStatisticsPage })));

// Order Statistics
const OrderStatistics = lazy(() => import("@/pages/order/statistics/orders").then((module) => ({ default: module.OrderStatisticsPage })));

// Production Statistics
const ProductionProductivityStatistics = lazy(() => import("@/pages/production/statistics/productivity").then((module) => ({ default: module.default })));
const ProductionPerformanceStatistics = lazy(() => import("@/pages/production/statistics/performance").then((module) => ({ default: module.default })));
const ProductionBottlenecksStatistics = lazy(() => import("@/pages/production/statistics/bottlenecks").then((module) => ({ default: module.default })));
const ProductionBonusValueStatistics = lazy(() => import("@/pages/production/statistics/bonus-value").then((module) => ({ default: module.default })));

// Financial Statistics
// Cobranças/Receita merged into a single unified "Visão Financeira" page (collection.tsx).
// The legacy /receita-orcamentos URL remains live and resolves to the same component
// so saved favorites and bookmarks keep working.
const FinancialOverviewStatistics = lazy(() => import("@/pages/financial/statistics/collection").then((module) => ({ default: module.default })));
const FinancialNfseStatistics = lazy(() => import("@/pages/financial/statistics/nfse").then((module) => ({ default: module.default })));

// HR Statistics
const HRPayrollStatistics = lazy(() => import("@/pages/personnel-department/statistics/payroll").then((module) => ({ default: module.default })));
const HRTeamPerformanceStatistics = lazy(() => import("@/pages/personnel-department/statistics/team-performance").then((module) => ({ default: module.default })));
const HRFaltasStatistics = lazy(() => import("@/pages/personnel-department/statistics/faltas").then((module) => ({ default: module.default })));
const HRSalaryCostStatistics = lazy(() => import("@/pages/personnel-department/statistics/salary-cost").then((module) => ({ default: module.default })));
const HRSkillAssessmentStatistics = lazy(() => import("@/pages/personnel-department/statistics/skill-assessment").then((module) => ({ default: module.default })));

// Statistics Hub Pages
const StatisticsHub = lazy(() => import("@/pages/statistics/index").then((module) => ({ default: module.default })));
const ProductionStatisticsHub = lazy(() => import("@/pages/production/statistics/index").then((module) => ({ default: module.default })));
const FinancialStatisticsHub = lazy(() => import("@/pages/financial/statistics/index").then((module) => ({ default: module.default })));
const HRStatisticsHub = lazy(() => import("@/pages/personnel-department/statistics/index").then((module) => ({ default: module.default })));

// Skill Assessment - Admin (Phase-4 rewrite)
const SkillListAdminPage = lazy(() => import("@/pages/administration/skill/list").then((m) => ({ default: m.SkillListPage })));
const SkillCreateAdminPage = lazy(() => import("@/pages/administration/skill/create").then((m) => ({ default: m.SkillCreatePage })));
const SkillDetailsAdminPage = lazy(() => import("@/pages/administration/skill/details/[id]").then((m) => ({ default: m.SkillDetailsPage })));
const SkillEditAdminPage = lazy(() => import("@/pages/administration/skill/edit/[id]").then((m) => ({ default: m.SkillEditPage })));
const SkillBatchEditAdminPage = lazy(() => import("@/pages/administration/skill/batch-edit").then((m) => ({ default: m.SkillBatchEditPage })));

const TopicListAdminPage = lazy(() => import("@/pages/administration/topic/list").then((m) => ({ default: m.TopicListPage })));
const TopicCreateAdminPage = lazy(() => import("@/pages/administration/topic/create").then((m) => ({ default: m.TopicCreatePage })));
const TopicDetailsAdminPage = lazy(() => import("@/pages/administration/topic/details/[id]").then((m) => ({ default: m.TopicDetailsPage })));
const TopicEditAdminPage = lazy(() => import("@/pages/administration/topic/edit/[id]").then((m) => ({ default: m.TopicEditPage })));
const TopicBatchEditAdminPage = lazy(() => import("@/pages/administration/topic/batch-edit").then((m) => ({ default: m.TopicBatchEditPage })));

const SkillAssessmentAdminList = lazy(() => import("@/pages/administration/skill-assessment/list").then((m) => ({ default: m.SkillAssessmentListPage })));
const SkillAssessmentAdminCreate = lazy(() => import("@/pages/administration/skill-assessment/create").then((m) => ({ default: m.SkillAssessmentCreatePage })));
const SkillAssessmentAdminDetails = lazy(() => import("@/pages/administration/skill-assessment/details/[id]").then((m) => ({ default: m.SkillAssessmentDetailsPage })));
const SkillAssessmentAdminEdit = lazy(() => import("@/pages/administration/skill-assessment/edit/[id]").then((m) => ({ default: m.SkillAssessmentEditPage })));
const SkillAssessmentAdminEntry = lazy(() => import("@/pages/administration/skill-assessment/entry/[entryId]").then((m) => ({ default: m.SkillAssessmentEntryDetailsPage })));

// Skill Assessment - Leader (Phase-4 rewrite: queue + per-entry fill)
const SkillAssessmentLeaderList = lazy(() => import("@/pages/production/skill-assessment/index").then((m) => ({ default: m.SkillAssessmentLeaderPage })));
const SkillAssessmentLeaderCampaign = lazy(() => import("@/pages/production/skill-assessment/[campaignId]").then((m) => ({ default: m.SkillAssessmentCampaignPage })));
const SkillAssessmentLeaderFill = lazy(() => import("@/pages/production/skill-assessment/fill/[entryId]").then((m) => ({ default: m.SkillAssessmentFillPage })));

// Self-fill questionnaire (all users)
const MyQuestionnairesPage = lazy(() => import("@/pages/questionnaire/mine").then((m) => ({ default: m.MyQuestionnairesPage })));
const QuestionnaireFillPage = lazy(() => import("@/pages/questionnaire/fill/[entryId]").then((m) => ({ default: m.QuestionnaireFillPage })));

// Questionnaire admin
const QuestionnaireAdminList = lazy(() => import("@/pages/administration/questionnaire/list").then((m) => ({ default: m.QuestionnaireListPage })));
const QuestionnaireAdminCreate = lazy(() => import("@/pages/administration/questionnaire/create").then((m) => ({ default: m.QuestionnaireCreatePage })));
const QuestionnaireAdminDetails = lazy(() => import("@/pages/administration/questionnaire/details/[id]").then((m) => ({ default: m.QuestionnaireDetailsPage })));
const QuestionnaireAdminEntry = lazy(() => import("@/pages/administration/questionnaire/entry/[entryId]").then((m) => ({ default: m.QuestionnaireEntryDetailsPage })));
const QuestionnaireTemasList = lazy(() => import("@/pages/administration/questionnaire/temas/list").then((m) => ({ default: m.QuestionnaireTemasListPage })));
const QuestionnaireTemaCreate = lazy(() => import("@/pages/administration/questionnaire/temas/create").then((m) => ({ default: m.QuestionnaireTemaCreatePage })));
const QuestionnaireTemaDetails = lazy(() => import("@/pages/administration/questionnaire/temas/details/[id]").then((m) => ({ default: m.QuestionnaireTemaDetailsPage })));
const QuestionnaireTemaEdit = lazy(() => import("@/pages/administration/questionnaire/temas/edit/[id]").then((m) => ({ default: m.QuestionnaireTemaEditPage })));
const QuestionnairePerguntasList = lazy(() => import("@/pages/administration/questionnaire/perguntas/list").then((m) => ({ default: m.QuestionnairePerguntasListPage })));
const QuestionnairePerguntaCreate = lazy(() => import("@/pages/administration/questionnaire/perguntas/create").then((m) => ({ default: m.QuestionnairePerguntaCreatePage })));
const QuestionnairePerguntaDetails = lazy(() => import("@/pages/administration/questionnaire/perguntas/details/[id]").then((m) => ({ default: m.QuestionnairePerguntaDetailsPage })));
const QuestionnairePerguntaEdit = lazy(() => import("@/pages/administration/questionnaire/perguntas/edit/[id]").then((m) => ({ default: m.QuestionnairePerguntaEditPage })));

// Personal
const Personal = lazy(() => import("@/pages/personal/root").then((module) => ({ default: module.Personal })));
const PersonalMyMessages = lazy(() => import("@/pages/personal/my-messages").then((module) => ({ default: module.MyMessagesPage })));
const PersonalMyHolidays = lazy(() => import("@/pages/personal/my-holidays").then((module) => ({ default: module.MyHolidaysPage })));
const PersonalMyPpes = lazy(() => import("@/pages/personal/my-ppes").then((module) => ({ default: module.MyPpesPage })));
const PersonalMyPpesRequest = lazy(() => import("@/pages/personal/my-ppes").then((module) => ({ default: module.PersonalMyPpesRequest })));
const PersonalMyLoans = lazy(() => import("@/pages/personal/my-loans").then((module) => ({ default: module.MyLoansPage })));
const PersonalMyActivities = lazy(() => import("@/pages/personal/my-activities").then((module) => ({ default: module.MyActivitiesPage })));
const PersonalMyWarnings = lazy(() => import("@/pages/personal/my-warnings").then((module) => ({ default: module.MyWarningsPage })));
const PersonalMyTimeEntries = lazy(() => import("@/pages/personal/my-time-entries").then((module) => ({ default: module.MyTimeEntriesPage })));
// Production Manager Pessoal section (company/team-wide views)
const PmWarnings = lazy(() => import("@/pages/personal/pm-warnings").then((module) => ({ default: module.PmWarningsPage })));
const PmCalculations = lazy(() => import("@/pages/personal/pm-calculations").then((module) => ({ default: module.PmCalculationsPage })));
const PmSchedules = lazy(() => import("@/pages/personal/pm-schedules").then((module) => ({ default: module.PmSchedulesPage })));

// Painting (Pintura)
const Paint = lazy(() => import("@/pages/painting/root").then((module) => ({ default: module.Painting })));
const PaintCatalog = lazy(() => import("@/pages/painting/catalog/list").then((module) => ({ default: module.CatalogListPage })));
const PaintCatalogCreate = lazy(() => import("@/pages/painting/catalog/create").then((module) => ({ default: module.CatalogCreatePage })));
const PaintCatalogEdit = lazy(() => import("@/pages/painting/catalog/edit/[id]").then((module) => ({ default: module.default })));
const PaintCatalogDetails = lazy(() => import("@/pages/painting/catalog/details/[id]").then((module) => ({ default: module.default })));
const PaintCatalogFormulas = lazy(() => import("@/pages/painting/catalog/details/[id]/formulas/index").then((module) => ({ default: module.default })));
const PaintProductions = lazy(() => import("@/pages/painting/productions/list"));
const PaintPaintTypes = lazy(() => import("@/pages/painting/paint-types/list").then((module) => ({ default: module.PaintTypesListPage })));
const PaintPaintTypesCreate = lazy(() => import("@/pages/painting/paint-types/create").then((module) => ({ default: module.PaintTypesCreatePage })));
const PaintPaintTypesEdit = lazy(() => import("@/pages/painting/paint-types/edit/[id]").then((module) => ({ default: module.default })));
const PaintPaintTypesDetails = lazy(() => import("@/pages/painting/paint-types/details/[id]").then((module) => ({ default: module.PaintTypeDetailsPage })));
const PaintBrands = lazy(() => import("@/pages/painting/paint-brands/list").then((module) => ({ default: module.PaintBrandsListPage })));
const PaintBrandsCreate = lazy(() => import("@/pages/painting/paint-brands/create").then((module) => ({ default: module.PaintBrandsCreatePage })));
const PaintBrandsEdit = lazy(() => import("@/pages/painting/paint-brands/edit/[id]").then((module) => ({ default: module.default })));
const PaintBrandsDetails = lazy(() => import("@/pages/painting/paint-brands/details/[id]").then((module) => ({ default: module.PaintBrandDetailsPage })));
const PaintFormulasList = lazy(() => import("@/pages/painting/formulas/list").then((module) => ({ default: module.default })));
const PaintFormulasCreate = lazy(() => import("@/pages/painting/formulas/create").then((module) => ({ default: module.default })));
const PaintFormulasEdit = lazy(() => import("@/pages/painting/formulas/edit/[id]").then((module) => ({ default: module.default })));
const PaintFormulaDetails = lazy(() => import("@/pages/painting/formulas/details/[id]").then((module) => ({ default: module.default })));
const PaintCatalogFormulaDetails = lazy(() => import("@/pages/painting/catalog/details/[id]/formulas/details/[formulaId]").then((module) => ({ default: module.default })));
const PaintProductionDetails = lazy(() => import("@/pages/painting/productions/details/[id]").then((module) => ({ default: module.default })));
const ColorPalettePage = lazy(() => import("@/pages/tools/color-palette"));

// Production
const Production = lazy(() => import("@/pages/production/root").then((module) => ({ default: module.ProductionRootPage })));
const ProductionObservations = lazy(() => import("@/pages/production/observations/list").then((module) => ({ default: module.ObservationsList })));
const ProductionObservationsCreate = lazy(() => import("@/pages/production/observations/create").then((module) => ({ default: module.ObservationCreate })));
const ProductionObservationsEdit = lazy(() => import("@/pages/production/observations/edit/[id]").then((module) => ({ default: module.ObservationEdit })));
const ProductionObservationsDetails = lazy(() => import("@/pages/production/observations/details/[id]").then((module) => ({ default: module.ObservationDetailsPage })));

// Airbrushing routes
const ProductionAirbrushing = lazy(() => import("@/pages/production/airbrushing/list").then((module) => ({ default: module.AirbrushingListPage })));
const ProductionAirbrushingCreate = lazy(() => import("@/pages/production/airbrushing/create").then((module) => ({ default: module.AirbrushingCreate })));
const ProductionAirbrushingEdit = lazy(() => import("@/pages/production/airbrushing/edit/[id]").then((module) => ({ default: module.AirbrushingEdit })));
const ProductionAirbrushingDetails = lazy(() => import("@/pages/production/airbrushing/details/[id]").then((module) => ({ default: module.AirbrushingDetails })));
const ProductionCutting = lazy(() => import("@/pages/production/cutting/list").then((module) => ({ default: module.default })));
const ProductionCuttingDetails = lazy(() => import("@/pages/production/cutting/details/[id]").then((module) => ({ default: module.CuttingDetailsPage })));

// Production Tasks
const ProductionTasksList = lazy(() => import("@/pages/production/schedule/list").then((module) => ({ default: module.TaskListPage })));
const ProductionTasksCalendar = lazy(() => import("@/pages/production/schedule/calendar").then((module) => ({ default: module.TaskScheduleCalendarPage })));
const ProductionTasksHistory = lazy(() => import("@/pages/production/history").then((module) => ({ default: module.TaskHistoryPage })));
const ProductionTasksBatchEdit = lazy(() => import("@/pages/production/schedule/batch-edit"));
const ProductionTasksCreate = lazy(() => import("@/pages/production/schedule/create"));
const ProductionTasksEdit = lazy(() => import("@/pages/production/schedule/edit/[id]").then((module) => ({ default: module.TaskEditPage })));
// Unified task-detail page — serves the Agenda, Cronograma and Histórico detail routes (it derives the
// section from the URL for source-aware breadcrumb / edit / prev-next).
const ProductionTaskDetail = lazy(() => import("@/components/production/task/detail/task-detail-page").then((module) => ({ default: module.TaskDetailPage })));
// ProductionTaskQuote removed - migrated to FinancialBudgetDetail
const ProductionPreparation = lazy(() => import("@/pages/production/preparation").then((module) => ({ default: module.PreparationPage })));
const ProductionGarages = lazy(() => import("@/pages/production/barracoes").then((module) => ({ default: module.GaragesPage })));

// Personnel Department
const PersonnelDepartment = lazy(() => import("@/pages/personnel-department/root").then((module) => ({ default: module.PersonnelDepartmentRootPage })));
const PersonnelDepartmentWarningsList = lazy(() => import("@/pages/personnel-department/warnings/list").then((module) => ({ default: module.WarningListPage })));
const PersonnelDepartmentWarningsCreate = lazy(() => import("@/pages/personnel-department/warnings/create").then((module) => ({ default: module.WarningCreatePage })));
const PersonnelDepartmentWarningsEdit = lazy(() => import("@/pages/personnel-department/warnings/edit/[id]").then((module) => ({ default: module.WarningEditPage })));
const PersonnelDepartmentWarningsDetails = lazy(() => import("@/pages/personnel-department/warnings/details/[id]").then((module) => ({ default: module.WarningDetailPage })));
const PersonnelDepartmentPositions = lazy(() => import("@/pages/personnel-department/positions/list").then((module) => ({ default: module.PositionListPage })));
const PersonnelDepartmentPositionsCreate = lazy(() => import("@/pages/personnel-department/positions/create").then((module) => ({ default: module.PositionCreatePage })));
const PersonnelDepartmentPositionsEdit = lazy(() => import("@/pages/personnel-department/positions/edit/[id]").then((module) => ({ default: module.PositionEditPage })));
const PersonnelDepartmentPositionsDetails = lazy(() => import("@/pages/personnel-department/positions/details/[id]").then((module) => ({ default: module.PositionDetailPage })));
const PersonnelDepartmentPositionsHierarchy = lazy(() => import("@/pages/personnel-department/positions/hierarchy").then((module) => ({ default: module.PositionHierarchyPage })));
const PersonnelDepartmentPositionsBatchEdit = lazy(() => import("@/pages/personnel-department/positions/batch-edit").then((module) => ({ default: module.PositionBatchEditPage })));
// Secullum integration mapping page (admin)
const SecullumMappingPage = lazy(() => import("@/pages/integrations/secullum/mapping").then((module) => ({ default: module.default })));
// Note: Employees pages are managed under Administration section, not Personnel Department
// EPI delivery & schedule pages now live under Medicina do Trabalho (Occupational Health).
// The DP EPI item catalog and "Tamanhos" pages were removed entirely.
const PersonnelDepartmentPpeDeliveries = lazy(() => import("@/pages/personnel-department/ppe/deliveries/list").then((module) => ({ default: module.PpeDeliveryListPage })));
const PersonnelDepartmentPpeDeliveriesCreate = lazy(() => import("@/pages/personnel-department/ppe/deliveries/create").then((module) => ({ default: module.EPIDeliveryCreate })));
const PersonnelDepartmentPpeDeliveriesEdit = lazy(() => import("@/pages/personnel-department/ppe/deliveries/edit/[id]").then((module) => ({ default: module.EPIDeliveryEdit })));
const PersonnelDepartmentPpeDeliveriesDetails = lazy(() => import("@/pages/personnel-department/ppe/deliveries/details/[id]").then((module) => ({ default: module.EPIDeliveryDetails })));
const PersonnelDepartmentPpeSchedules = lazy(() => import("@/pages/personnel-department/ppe/schedules/list").then((module) => ({ default: module.PPESchedulesListPage })));
const PersonnelDepartmentPpeSchedulesCreate = lazy(() => import("@/pages/personnel-department/ppe/schedules/create").then((module) => ({ default: module.PPEScheduleCreatePage })));
const PersonnelDepartmentPpeSchedulesEdit = lazy(() => import("@/pages/personnel-department/ppe/schedules/edit/[id]").then((module) => ({ default: module.PPEScheduleEditPage })));
const PersonnelDepartmentPpeSchedulesDetails = lazy(() => import("@/pages/personnel-department/ppe/schedules/details/[id]").then((module) => ({ default: module.PPEScheduleDetailsPage })));
const PersonnelDepartmentRequisitions = lazy(() => import("@/pages/personnel-department/requisitions/list").then((module) => ({ default: module.default })));
const PersonnelDepartmentHolidays = lazy(() => import("@/pages/personnel-department/holidays/list").then((module) => ({ default: module.HolidayListPage })));
const PersonnelDepartmentHolidaysCalendar = lazy(() => import("@/pages/personnel-department/holidays/calendar").then((module) => ({ default: module.HolidayCalendarPage })));
const PersonnelDepartmentHolidaysCreate = lazy(() => import("@/pages/personnel-department/holidays/cadastrar").then((module) => ({ default: module.HolidayCreatePage })));
const PersonnelDepartmentSchedules = lazy(() => import("@/pages/personnel-department/schedules/list").then((module) => ({ default: module.SchedulesListPage })));
const PersonnelDepartmentHRCalendar = lazy(() => import("@/pages/personnel-department/calendar").then((module) => ({ default: module.HRCalendarPage })));
const PersonnelDepartmentTimeClock = lazy(() => import("@/pages/personnel-department/time-clock/list"));
const PersonnelDepartmentTimeClockColaborador = lazy(
  () => import("@/pages/personnel-department/time-clock/colaborador"),
);
const PersonnelDepartmentTimeClockDia = lazy(() => import("@/pages/personnel-department/time-clock/dia"));
const PersonnelDepartmentTimeClockEdicao = lazy(() => import("@/pages/personnel-department/time-clock/edicao"));
const PersonnelDepartmentTimeClockAusencias = lazy(
  () => import("@/pages/personnel-department/time-clock/ausencias"),
);
// "Fechamento" (page files still live under the assinatura-digital folder).
const PersonnelDepartmentFechamentoList = lazy(
  () => import("@/pages/personnel-department/time-clock/assinatura-digital/list"),
);
const PersonnelDepartmentFechamentoDetails = lazy(
  () => import("@/pages/personnel-department/time-clock/assinatura-digital/details"),
);
const PersonnelDepartmentPerformanceLevels = lazy(() => import("@/pages/personnel-department/performance-levels/list").then((module) => ({ default: module.default })));

// Catalog
const CatalogList = lazy(() => import("@/pages/catalog/list").then((module) => ({ default: module.default })));
const CatalogDetails = lazy(() => import("@/pages/catalog/details/[id]").then((module) => ({ default: module.default })));

// My Team
const MyTeam = lazy(() => import("@/pages/my-team/index").then((module) => ({ default: module.default })));
const MyTeamWarnings = lazy(() => import("@/pages/my-team/warnings").then((module) => ({ default: module.default })));
const MyTeamLoans = lazy(() => import("@/pages/my-team/loans").then((module) => ({ default: module.default })));
const MyTeamMembers = lazy(() => import("@/pages/my-team/members").then((module) => ({ default: module.default })));
const MyTeamPpes = lazy(() => import("@/pages/my-team/ppes").then((module) => ({ default: module.default })));
const MyTeamMovements = lazy(() => import("@/pages/my-team/movements").then((module) => ({ default: module.default })));
const MyTeamCalculations = lazy(() => import("@/pages/my-team/calculations").then((module) => ({ default: module.default })));

// Server
const Server = lazy(() => import("@/pages/server/root").then((module) => ({ default: module.ServerRootPage })));
const ServerBackup = lazy(() => import("@/pages/server/backup").then((module) => ({ default: module.BackupManagementPage })));
const ServerDatabaseSync = lazy(() => import("@/pages/server/database-sync").then((module) => ({ default: module.DatabaseSyncPage })));
const ServerDeployments = lazy(() => import("@/pages/server/deployments").then((module) => ({ default: module.DeploymentListPage })));
const ServerDeploymentDetails = lazy(() => import("@/pages/server/deployments/[id]").then((module) => ({ default: module.DeploymentDetailPage })));
const ServerLogs = lazy(() => import("@/pages/server/logs").then((module) => ({ default: module.ServerLogsPage })));
const ServerMetrics = lazy(() => import("@/pages/server/metrics").then((module) => ({ default: module.ServerMetricsPage })));
const ServerServices = lazy(() => import("@/pages/server/services").then((module) => ({ default: module.ServerServicesPage })));
const ServerFileManager = lazy(() => import("@/pages/server/file-manager").then((module) => ({ default: module.ServerFileManagerPage })));
const ServerUsers = lazy(() => import("@/pages/server/users").then((module) => ({ default: module.ServerUsersPage })));
const ServerRateLimiting = lazy(() => import("@/pages/server/rate-limiting").then((module) => ({ default: module.RateLimitingPage })));

// Tools
const ToolsHubPage = lazy(() => import("@/pages/tools").then((module) => ({ default: module.ToolsHubPage })));
const QrCodeToolPage = lazy(() => import("@/pages/tools/qr-code").then((module) => ({ default: module.QrCodeToolPage })));
const TimeCalculatorPage = lazy(() => import("@/pages/tools/time-calculator"));
const OvertimeCostCalculatorPage = lazy(() => import("@/pages/tools/overtime-cost-calculator"));
const EmployeeCostCalculatorPage = lazy(() => import("@/pages/tools/employee-cost-calculator"));
const PostItsPage = lazy(() => import("@/pages/tools/post-its"));
const PaintMixCalculatorPage = lazy(() => import("@/pages/tools/paint-mix-calculator"));
const WasteCertificateToolPage = lazy(() => import("@/pages/tools/waste-certificate").then((module) => ({ default: module.WasteCertificateToolPage })));

function App() {
  // Initialize web notifications
  useEffect(() => {
    setupWebNotifications();
  }, []);

  return (
    <Router>
      {/* Mobile browsers are steered to the public /install page (see guard).
          Mounted at the router root so it covers every route; it exempts /install,
          auth callbacks and public share links, and never affects desktop. */}
      <MobileUsageGuard />
      <ThemeProvider defaultTheme="light" storageKey="ankaa-ui-theme">
        <TooltipProvider skipDelayDuration={0}>
          <ErrorBoundary>
          <Routes>
            {/* Customer routes (no authentication, no notifications) - MUST be first */}
            <Route
              path={routes.customer.budget(":customerId", ":id")}
              element={
                <Suspense fallback={<PageLoader />}>
                  <PublicBudgetPage />
                </Suspense>
              }
            />
            <Route
              path={routes.customer.serviceReport(":customerId", ":id")}
              element={
                <Suspense fallback={<PageLoader />}>
                  <PublicServiceReportPage />
                </Suspense>
              }
            />
            <Route
              path={routes.publicWasteCertificate(":id")}
              element={
                <Suspense fallback={<PageLoader />}>
                  <PublicWasteCertificatePage />
                </Suspense>
              }
            />
            <Route
              path={routes.privacyPolicy}
              element={
                <Suspense fallback={<PageLoader />}>
                  <PrivacyPolicyPage />
                </Suspense>
              }
            />

            {/* Public app-install landing page — no auth, no providers, and excluded
                from the mobile-redirect guard (it is the guard's destination). */}
            <Route
              path={routes.install}
              element={
                <Suspense fallback={<PageLoader />}>
                  <InstallPage />
                </Suspense>
              }
            />

            {/* NOTE: /.well-known/* (apple-app-site-association, assetlinks.json) is
                served as static files by nginx and MUST NOT be handled by this SPA
                router. It is intentionally absent here; the catch-all "*" below only
                applies to client-side app routes, never to /.well-known. */}

            {/* Hidden screen-recording demo — fully public, no auth, no providers. Delete when done. */}
            <Route
              path="/dashboard-demo"
              element={
                <Suspense fallback={<PageLoader />}>
                  <DashboardDemoPage />
                </Suspense>
              }
            />

            {/* All other routes wrapped in auth and notification providers */}
            <Route
              path="*"
              element={
                <AuthProvider>
                  <SidebarProvider>
                    <PricingProvider>
                    <SocketNotificationsListener />
                    <SocketReconnectHandler />
                    <AppVersionChecker />
                    <FavoritesProvider>
                      <FileViewerProvider>
                        <MessageModalProvider>
                          <Toaster />
                          <SpotlightSearch />
                          <PushNotificationSetup />
                          <PricingVisibilityBoundary>
                          <Routes>
                            {/* Auth routes */}
                            <Route element={<AuthLayout />}>
                              <Route path={routes.authentication.login} element={<LoginPage />} />
                              <Route path={routes.authentication.register} element={<RegisterPage />} />
                              <Route path={routes.authentication.recoverPassword} element={<RecoverPasswordPage />} />
                              <Route path={routes.authentication.verifyCode} element={<VerifyCodePage />} />
                              <Route path={routes.authentication.verifyPasswordReset} element={<VerifyPasswordResetPage />} />
                              <Route path={routes.authentication.resetPassword(":token")} element={<ResetPasswordPage />} />
                            </Route>

                            {/* Protected routes with automatic privilege checking */}
              <Route
                element={
                  <AutoPrivilegeRoute>
                    <MainLayout />
                  </AutoPrivilegeRoute>
                }
              >
                <Route
                  path="/"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HomePage />
                    </Suspense>
                  }
                />

                {/* Favorites route */}
                <Route
                  path={routes.favorites}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FavoritesPage />
                    </Suspense>
                  }
                />

                {/* DataTable base-components demo */}
                <Route
                  path="/data-table-demo"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <DataTableDemoPage />
                    </Suspense>
                  }
                />

                {/* Detail-page base-components demo (open a row from the DataTable demo) */}
                <Route path="/detail-page-demo" element={<Navigate to="/detail-page-demo/order-1" replace />} />
                <Route
                  path="/detail-page-demo/:id"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <DetailPageDemoPage />
                    </Suspense>
                  }
                />

                {/* Profile route */}
                <Route
                  path="/perfil"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProfilePage />
                    </Suspense>
                  }
                />

                {/* Notifications route */}
                <Route
                  path={routes.profileNotifications}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <NotificationPreferencesPage />
                    </Suspense>
                  }
                />

                {/* Test Notification Workflow */}
                <Route
                  path="/test-notifications"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <TestNotificationWorkflow />
                    </Suspense>
                  }
                />

                {/* Production routes */}
                <Route
                  path={routes.production.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <Production />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.schedule.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTasksList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.calendar}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTasksCalendar />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.schedule.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTasksBatchEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.preparation.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTasksCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.schedule.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTasksEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.preparation.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTasksEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.history.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTasksEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.schedule.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTaskDetail />
                    </Suspense>
                  }
                />

                {/* Old quote routes removed - migrated to /financeiro/orcamento */}
                <Route
                  path={routes.production.preparation.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionPreparation />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.preparation.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTaskDetail />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.production.history.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTasksHistory />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.history.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTaskDetail />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.cutting.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionCutting />
                    </Suspense>
                  }
                />
                <Route
                  path="/producao/recorte/detalhes/:id"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionCuttingDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.observations.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionObservations />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.observations.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionObservationsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.observations.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionObservationsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.observations.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionObservationsDetails />
                    </Suspense>
                  }
                />

                {/* Airbrushing routes */}
                <Route
                  path={routes.production.airbrushings.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionAirbrushing />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.airbrushings.list}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionAirbrushing />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.airbrushings.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionAirbrushingCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.airbrushings.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionAirbrushingEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.airbrushings.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionAirbrushingDetails />
                    </Suspense>
                  }
                />

                {/* Garages route */}
                <Route
                  path={routes.production.garages.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionGarages />
                    </Suspense>
                  }
                />

                {/* Admin Skill catalogue routes (Phase-4 rewrite) */}
                <Route
                  path={routes.administration.skill.root}
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillListAdminPage />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path={routes.administration.skill.create}
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillCreateAdminPage />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path={routes.administration.skill.batchEdit}
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillBatchEditAdminPage />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path="/administracao/competencias/detalhes/:id"
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillDetailsAdminPage />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path="/administracao/competencias/editar/:id"
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillEditAdminPage />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />

                {/* Admin Topic catalogue routes */}
                <Route
                  path={routes.administration.topic.root}
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <TopicListAdminPage />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path={routes.administration.topic.create}
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <TopicCreateAdminPage />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path={routes.administration.topic.batchEdit}
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <TopicBatchEditAdminPage />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path="/administracao/topicos/detalhes/:id"
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <TopicDetailsAdminPage />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path="/administracao/topicos/editar/:id"
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <TopicEditAdminPage />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />

                {/* Admin Skill-Assessment campaign routes */}
                <Route
                  path={routes.administration.skillAssessment.root}
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillAssessmentAdminList />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path={routes.administration.skillAssessment.create}
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillAssessmentAdminCreate />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path="/administracao/avaliacao-competencias/:id/editar"
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillAssessmentAdminEdit />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path="/administracao/avaliacao-competencias/:id/avaliacoes/:entryId"
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillAssessmentAdminEntry />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path="/administracao/avaliacao-competencias/:id"
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillAssessmentAdminDetails />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                {/* Leader skill assessment routes (Phase-4 rewrite) */}
                <Route
                  path={routes.skillAssessmentLeader.pending}
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillAssessmentLeaderList />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path="/meu-pessoal/avaliacoes-competencias/:campaignId"
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillAssessmentLeaderCampaign />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path="/meu-pessoal/avaliacoes-competencias/preencher/:entryId"
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SkillAssessmentLeaderFill />
                      </Suspense>
                    </AutoPrivilegeRoute>
                  }
                />

                {/* Questionnaire admin routes (specific paths before /:id) */}
                <Route
                  path={routes.administration.questionnaire.root}
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}><QuestionnaireAdminList /></Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path={routes.administration.questionnaire.create}
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}><QuestionnaireAdminCreate /></Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route path={routes.administration.questionnaire.temas} element={<AutoPrivilegeRoute><Suspense fallback={<PageLoader />}><QuestionnaireTemasList /></Suspense></AutoPrivilegeRoute>} />
                <Route path={routes.administration.questionnaire.temaCreate} element={<AutoPrivilegeRoute><Suspense fallback={<PageLoader />}><QuestionnaireTemaCreate /></Suspense></AutoPrivilegeRoute>} />
                <Route path="/administracao/questionarios-temas/:id/editar" element={<AutoPrivilegeRoute><Suspense fallback={<PageLoader />}><QuestionnaireTemaEdit /></Suspense></AutoPrivilegeRoute>} />
                <Route path="/administracao/questionarios-temas/:id" element={<AutoPrivilegeRoute><Suspense fallback={<PageLoader />}><QuestionnaireTemaDetails /></Suspense></AutoPrivilegeRoute>} />
                <Route path={routes.administration.questionnaire.perguntas} element={<AutoPrivilegeRoute><Suspense fallback={<PageLoader />}><QuestionnairePerguntasList /></Suspense></AutoPrivilegeRoute>} />
                <Route path={routes.administration.questionnaire.perguntaCreate} element={<AutoPrivilegeRoute><Suspense fallback={<PageLoader />}><QuestionnairePerguntaCreate /></Suspense></AutoPrivilegeRoute>} />
                <Route path="/administracao/questionarios-perguntas/:id/editar" element={<AutoPrivilegeRoute><Suspense fallback={<PageLoader />}><QuestionnairePerguntaEdit /></Suspense></AutoPrivilegeRoute>} />
                <Route path="/administracao/questionarios-perguntas/:id" element={<AutoPrivilegeRoute><Suspense fallback={<PageLoader />}><QuestionnairePerguntaDetails /></Suspense></AutoPrivilegeRoute>} />
                <Route
                  path="/administracao/questionarios/:id/respostas/:entryId"
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}><QuestionnaireAdminEntry /></Suspense>
                    </AutoPrivilegeRoute>
                  }
                />
                <Route
                  path="/administracao/questionarios/:id"
                  element={
                    <AutoPrivilegeRoute>
                      <Suspense fallback={<PageLoader />}><QuestionnaireAdminDetails /></Suspense>
                    </AutoPrivilegeRoute>
                  }
                />

                {/* Self-fill questionnaire routes — personal domain, ALL users */}
                <Route
                  path={routes.questionnaire.mine}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <MyQuestionnairesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/pessoal/questionarios/preencher/:entryId"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <QuestionnaireFillPage />
                    </Suspense>
                  }
                />

                {/* Administration routes */}
                <Route
                  path={routes.administration.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <Administration />
                    </Suspense>
                  }
                />


                {/* Responsibles Routes */}
                <Route
                  path={routes.responsibles.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ResponsiblesList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.responsibles.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ResponsiblesNew />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.responsibles.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ResponsiblesDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.responsibles.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ResponsiblesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.responsibles.password(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ResponsiblesPassword />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.administration.collaborators.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationCollaboratorsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.collaborators.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationCollaboratorsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.collaborators.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationCollaboratorsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.collaborators.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationCollaboratorsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.collaborators.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationCollaboratorsBatchEdit />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.personnelDepartment.payroll.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPayrollList />
                    </Suspense>
                  }
                />
                {/* Payroll detail route by ID */}
                <Route
                  path="/departamento-pessoal/folha-de-pagamento/detalhe/:payrollId"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPayrollDetail />
                    </Suspense>
                  }
                />
                {/* Bonus routes */}
                <Route
                  path={routes.personnelDepartment.bonus.list}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentBonusList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.bonus.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentBonusDetail />
                    </Suspense>
                  }
                />
                {/* Bonus simulation route - under bonus domain */}
                <Route
                  path={routes.personnelDepartment.bonus.simulation}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentBonusSimulation />
                    </Suspense>
                  }
                />
                {/* Legacy redirect for old simulation URL */}
                <Route
                  path="/departamento-pessoal/simulacao-bonus"
                  element={<Navigate to={routes.personnelDepartment.bonus.simulation} replace />}
                />
                <Route
                  path={routes.administration.sectors.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationSectorsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.sectors.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationSectorsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.sectors.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationSectorsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.sectors.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationSectorsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.sectors.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationSectorsBatchEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.goals.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationGoalsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.appDistribution.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AppDistributionPage />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.administration.notifications.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationNotifications />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.notifications.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationNotificationsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.notifications.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationNotificationsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.notifications.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationNotificationsSend />
                    </Suspense>
                  }
                />

                {/* Notification Configuration Routes */}
                <Route
                  path={routes.administration.notifications.configurations.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationNotificationConfigurationsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.notifications.configurations.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationNotificationConfigurationsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.notifications.configurations.details(":key")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationNotificationConfigurationsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.notifications.configurations.edit(":key")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationNotificationConfigurationsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.notifications.configurations.test(":key")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationNotificationConfigurationsTest />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.messages.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationMessages />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.messages.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationMessagesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.messages.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationMessagesDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.messages.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationMessagesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.server.changeLogs.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationChangeLogs />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.server.changeLogs.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationChangeLogsDetails />
                    </Suspense>
                  }
                />

                {/* Financial routes (URL in Portuguese: /financeiro) */}
                <Route
                  path={routes.financial.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialRoot />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.customers.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialCustomersList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.customers.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialCustomersCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.customers.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialCustomersDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.customers.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialCustomersEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.customers.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialCustomersBatchEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.billing.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialBilling />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.billing.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialBillingDetail />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.billing.documentPreview}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialBillingDocumentPreview />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.nfse.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialNotasFiscais />
                    </Suspense>
                  }
                />
                <Route
                  path="/financeiro/notas-fiscais/:id"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialNfseDetail />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.reconciliation.root}
                  element={<Navigate to={routes.financial.reconciliation.statement} replace />}
                />
                <Route
                  path="/financeiro/conciliacao/extratos"
                  element={<Navigate to={routes.financial.reconciliation.statement} replace />}
                />
                <Route
                  path={routes.financial.reconciliation.statement}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ReconciliationStatement />
                    </Suspense>
                  }
                />
                {/* Saídas/Entradas were merged into the Extrato (type + status
                    filters live there now). Old links redirect. */}
                <Route
                  path={routes.financial.reconciliation.outflows}
                  element={<Navigate to={routes.financial.reconciliation.statement} replace />}
                />
                {/* Entradas hosts "Contas a Receber" — the inflow analog of
                    Contas a Pagar (receivable installments + boleto/conciliação). */}
                <Route
                  path={routes.financial.accountsReceivable.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ReceivablesListPage />
                    </Suspense>
                  }
                />
                {/* Previsão de Saídas was merged into Contas a Pagar. Old links
                    (current + legacy conciliação path) redirect there. */}
                <Route
                  path={routes.financial.outflowForecast}
                  element={<Navigate to={routes.financial.accountsPayable.root} replace />}
                />
                <Route
                  path="/financeiro/conciliacao/previsao-de-saidas"
                  element={<Navigate to={routes.financial.accountsPayable.root} replace />}
                />
                {/* Transações was merged into the Extrato (day-grouped accordion
                    + type/status filters live there now). Old links redirect. */}
                <Route
                  path={routes.financial.reconciliation.transactions}
                  element={<Navigate to={routes.financial.reconciliation.statement} replace />}
                />
                <Route
                  path="/financeiro/conciliacao/transacoes/:id"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ReconciliationTransactionDetail />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.reconciliation.fiscalDocuments}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialNotasFiscais defaultSegment="recebidas" />
                    </Suspense>
                  }
                />
                <Route
                  path="/financeiro/conciliacao/notas/:id"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ReconciliationFiscalDocumentDetail />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.reconciliation.categories}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ReconciliationCategoriesList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.accountsPayable.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AccountsPayableListPage />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.recurrentPayables.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <RecurrentPayablesListPage />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.recurrentPayables.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <CreateRecurrentPayablePage />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.recurrentPayables.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <EditRecurrentPayablePage />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.budget.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialBudgetList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.budget.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialBudgetCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.financial.budget.details(":taskId")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialBudgetDetail />
                    </Suspense>
                  }
                />

                {/* Statistics Hub Pages */}
                <Route
                  path={routes.statistics.root}
                  element={<Suspense fallback={<PageLoader />}><StatisticsHub /></Suspense>}
                />
                <Route
                  path={routes.statistics.production.root}
                  element={<Suspense fallback={<PageLoader />}><ProductionStatisticsHub /></Suspense>}
                />
                <Route
                  path={routes.statistics.financial.root}
                  element={<Suspense fallback={<PageLoader />}><FinancialStatisticsHub /></Suspense>}
                />
                <Route
                  path={routes.statistics.personnelDepartment.root}
                  element={<Suspense fallback={<PageLoader />}><HRStatisticsHub /></Suspense>}
                />
                {/* Production Statistics routes */}
                <Route
                  path={routes.statistics.production.productivity}
                  element={<Suspense fallback={<PageLoader />}><ProductionProductivityStatistics /></Suspense>}
                />
                <Route
                  path={routes.statistics.production.performance}
                  element={<Suspense fallback={<PageLoader />}><ProductionPerformanceStatistics /></Suspense>}
                />
                <Route
                  path={routes.statistics.production.bottlenecks}
                  element={<Suspense fallback={<PageLoader />}><ProductionBottlenecksStatistics /></Suspense>}
                />
                <Route
                  path={routes.statistics.production.bonusValue}
                  element={<Suspense fallback={<PageLoader />}><ProductionBonusValueStatistics /></Suspense>}
                />
                {/* Financial Statistics routes */}
                {/* /cobrancas + /receita-orcamentos both mount the unified Visão Financeira page */}
                <Route
                  path={routes.statistics.financial.collection}
                  element={<Suspense fallback={<PageLoader />}><FinancialOverviewStatistics /></Suspense>}
                />
                <Route
                  path={routes.statistics.financial.revenueQuotes}
                  element={<Suspense fallback={<PageLoader />}><FinancialOverviewStatistics /></Suspense>}
                />
                <Route
                  path={routes.statistics.financial.nfse}
                  element={<Suspense fallback={<PageLoader />}><FinancialNfseStatistics /></Suspense>}
                />
                <Route
                  path={routes.statistics.financial.reconciliation}
                  element={<Suspense fallback={<PageLoader />}><ReconciliationStatistics /></Suspense>}
                />

                {/* HR Statistics routes */}
                <Route
                  path={routes.statistics.personnelDepartment.payroll}
                  element={<Suspense fallback={<PageLoader />}><HRPayrollStatistics /></Suspense>}
                />
                <Route
                  path={routes.statistics.personnelDepartment.salaryCost}
                  element={<Suspense fallback={<PageLoader />}><HRSalaryCostStatistics /></Suspense>}
                />
                <Route
                  path={routes.statistics.personnelDepartment.teamPerformance}
                  element={<Suspense fallback={<PageLoader />}><HRTeamPerformanceStatistics /></Suspense>}
                />
                <Route
                  path={routes.statistics.personnelDepartment.absenteeism}
                  element={<Suspense fallback={<PageLoader />}><HRFaltasStatistics /></Suspense>}
                />
                <Route
                  path={routes.statistics.personnelDepartment.skillAssessment}
                  element={<Suspense fallback={<PageLoader />}><HRSkillAssessmentStatistics /></Suspense>}
                />

                {/* Statistics routes - Under Construction (catch-all for unimplemented) */}
                <Route
                  path="/estatisticas/*"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <UnderConstruction />
                    </Suspense>
                  }
                />

                {/* Inventory Statistics routes */}
                <Route
                  path={routes.statistics.inventory.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryStatistics />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.statistics.inventory.consumption}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryStatisticsConsumption />
                    </Suspense>
                  }
                />
                {/* Order Statistics (Inventory) */}
                <Route
                  path={routes.statistics.inventory.orders}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OrderStatistics />
                    </Suspense>
                  }
                />
                {/* Inventory routes */}
                <Route
                  path={routes.inventory.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <Inventory />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.loans.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryLoans />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.loans.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryLoansCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.loans.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryLoansDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.loans.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryLoansBatchEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.ppe.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryPpe />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.ppe.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryPpeCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.ppe.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryPpeEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.ppe.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryPpeDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.ppe.deliveries.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryPpeDeliveries />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.ppe.deliveries.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryPpeDeliveriesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.ppe.deliveries.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryPpeDeliveriesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.ppe.deliveries.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryPpeDeliveriesDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.ppe.schedules.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryPpeSchedules />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.ppe.schedules.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryPpeSchedulesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.ppe.schedules.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryPpeSchedulesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.ppe.schedules.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryPpeSchedulesDetails />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.inventory.suppliers.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventorySuppliers />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.suppliers.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <SuppliersCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.suppliers.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <SuppliersEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.suppliers.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <SuppliersDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.suppliers.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <SuppliersBatchEdit />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.inventory.warehouseLocations.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryWarehouseLocations />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.inventory.maintenance.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMaintenance />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.maintenance.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMaintenanceCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.maintenance.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMaintenanceEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.maintenance.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMaintenanceDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.maintenance.schedules.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMaintenanceSchedules />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.maintenance.schedules.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMaintenanceSchedulesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.maintenance.schedules.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMaintenanceSchedulesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.maintenance.schedules.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMaintenanceSchedulesDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.movements.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMovements />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.movements.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMovementsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.movements.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMovementsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.movements.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMovementsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.movements.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMovementsBatchEdit />
                    </Suspense>
                  }
                />

                {/* External Operations routes */}
                <Route
                  path={routes.inventory.externalOperations.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryExternalOperations />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.externalOperations.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryExternalOperationsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.externalOperations.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryExternalOperationsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.externalOperations.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryExternalOperationsDetails />
                    </Suspense>
                  }
                />

                {/* Orders routes */}
                <Route
                  path={routes.inventory.orders.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryOrders />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.orders.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryOrdersCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.orders.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryOrdersEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.orders.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryOrdersDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.orders.schedules.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryOrdersSchedules />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.orders.schedules.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryOrdersSchedulesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.orders.schedules.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryOrdersSchedulesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.orders.schedules.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryOrdersSchedulesDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.orders.automatic.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryOrdersAutomatic />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.orders.automatic.configure}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryOrdersAutomaticConfigure />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.inventory.products.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProducts />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsBatchEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.stockBalance}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsStockBalance />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.stockBalance.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryStockBalanceCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.categories.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsCategories />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.categories.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsCategoriesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.categories.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsCategoriesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.categories.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsCategoriesDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.categories.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsCategoriesBatchEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.brands.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsBrands />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.brands.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsBrandsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.brands.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsBrandsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.brands.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsBrandsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.products.brands.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryProductsBrandsBatchEdit />
                    </Suspense>
                  }
                />

                {/* Personal routes */}
                <Route
                  path={routes.personal.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <Personal />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personal.myMessages.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalMyMessages />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personal.myHolidays.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalMyHolidays />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personal.myPpes.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalMyPpes />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personal.myPpes.request}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalMyPpesRequest />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personal.myLoans.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalMyLoans />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personal.myActivities.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalMyActivities />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personal.myWarnings.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalMyWarnings />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personal.myTimeEntries.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalMyTimeEntries />
                    </Suspense>
                  }
                />

                {/* Production Manager Pessoal routes */}
                <Route
                  path={routes.personal.pmWarnings.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PmWarnings />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personal.pmCalculations.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PmCalculations />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personal.pmSchedules.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PmSchedules />
                    </Suspense>
                  }
                />

                {/* Paint routes */}
                <Route
                  path={routes.painting.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <Paint />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.catalog.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintCatalog />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.catalog.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintCatalogCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.catalog.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintCatalogEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.catalog.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintCatalogDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.catalog.formulas(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintCatalogFormulas />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.catalog.formulaDetails(":id", ":formulaId")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintCatalogFormulaDetails />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.painting.formulas.list}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintFormulasList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.formulas.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintFormulasCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.formulas.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintFormulasEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.formulas.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintFormulaDetails />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.painting.productions.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintProductions />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.productions.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintProductionDetails />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.painting.paintTypes.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintPaintTypes />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.paintTypes.list}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintPaintTypes />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.paintTypes.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintPaintTypesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.paintTypes.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintPaintTypesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.paintTypes.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintPaintTypesDetails />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.painting.paintBrands.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintBrands />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.paintBrands.list}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintBrands />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.paintBrands.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintBrandsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.paintBrands.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintBrandsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.painting.paintBrands.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintBrandsDetails />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.painting.palette.root}
                  element={<Navigate to={routes.tools.colorPalette.root} replace />}
                />

                {/* Personnel Department routes */}
                <Route
                  path={routes.personnelDepartment.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartment />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.warnings.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentWarningsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.warnings.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentWarningsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.warnings.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentWarningsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.warnings.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentWarningsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.positions.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPositions />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.positions.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPositionsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.positions.hierarchy}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPositionsHierarchy />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.positions.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPositionsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.positions.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPositionsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.positions.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPositionsBatchEdit />
                    </Suspense>
                  }
                />
                {/* Secullum integration — admin mapping page */}
                <Route
                  path={routes.personnelDepartment.integrations.secullum.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <SecullumMappingPage />
                    </Suspense>
                  }
                />
                {/* Note: employees routes are under administration.employees, not personnelDepartment */}
                {/* EPI delivery & schedule pages — now under Medicina do Trabalho. */}
                <Route
                  path={routes.occupationalHealth.ppe.deliveries.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPpeDeliveries />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.ppe.deliveries.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPpeDeliveriesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.ppe.deliveries.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPpeDeliveriesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.ppe.deliveries.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPpeDeliveriesDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.ppe.schedules.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPpeSchedules />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.ppe.schedules.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPpeSchedulesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.ppe.schedules.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPpeSchedulesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.ppe.schedules.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPpeSchedulesDetails />
                    </Suspense>
                  }
                />
                {/* Legacy URL — the unified Controle de Ponto page lives at
                    /departamento-pessoal/controle-ponto with `?view=` query
                    param selecting the mode (colaborador-unico is default). */}
                <Route
                  path={routes.personnelDepartment.calculations.root}
                  element={
                    <Navigate to={routes.personnelDepartment.timeClock.list} replace />
                  }
                />
                <Route
                  path={routes.personnelDepartment.requisicoes.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentRequisitions />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.holidays.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentHolidays />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.holidays.calendar}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentHolidaysCalendar />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.holidays.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentHolidaysCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.horarios.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentSchedules />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.calendar.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentHRCalendar />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.timeClock.list}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentTimeClock />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.timeClock.colaborador}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentTimeClockColaborador />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.timeClock.dia}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentTimeClockDia />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.timeClock.edicao}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentTimeClockEdicao />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.timeClock.ausencias}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentTimeClockAusencias />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.timeClock.fechamento.list}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentFechamentoList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.timeClock.fechamento.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentFechamentoDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.bonus.performanceLevels.list}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPerformanceLevels />
                    </Suspense>
                  }
                />

                {/* Departamento Pessoal — Admissões */}
                <Route
                  path={routes.personnelDepartment.admissions.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentAdmissionsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.admissions.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentAdmissionsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.admissions.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentAdmissionsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.admissions.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentAdmissionsEdit />
                    </Suspense>
                  }
                />
                {/* Departamento Pessoal — Rescisões */}
                <Route
                  path={routes.personnelDepartment.terminations.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentTerminationsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.terminations.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentTerminationsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.terminations.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentTerminationsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.terminations.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentTerminationsEdit />
                    </Suspense>
                  }
                />
                {/* Departamento Pessoal — Férias */}
                <Route
                  path={routes.personnelDepartment.vacations.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentVacationsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.vacations.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentVacationsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.vacations.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentVacationsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.vacations.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentVacationsEdit />
                    </Suspense>
                  }
                />
                {/* Férias Coletivas foram aposentadas — coletiva agora é só um
                    multiselect no cadastro de Férias. Redireciona links antigos. */}
                <Route
                  path="/departamento-pessoal/ferias/coletiva/detalhes/:id"
                  element={<Navigate to={routes.personnelDepartment.vacations.root} replace />}
                />
                {/* 13º Salário não tem mais páginas dedicadas — passou a ser
                    gerido por colaborador (na tela de detalhe do colaborador).
                    Links/bookmarks antigos redirecionam para a lista de colaboradores. */}
                <Route path={routes.personnelDepartment.thirteenth.root} element={<Navigate to={routes.administration.collaborators.root} replace />} />
                <Route path={routes.personnelDepartment.thirteenth.create} element={<Navigate to={routes.administration.collaborators.root} replace />} />
                <Route path={routes.personnelDepartment.thirteenth.details(":id")} element={<Navigate to={routes.administration.collaborators.root} replace />} />
                <Route path={routes.personnelDepartment.thirteenth.edit(":id")} element={<Navigate to={routes.administration.collaborators.root} replace />} />
                {/* Departamento Pessoal — Empréstimos */}
                <Route
                  path={routes.personnelDepartment.loans.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentLoansList />
                    </Suspense>
                  }
                />
                {/* Departamento Pessoal — Salários e Cargos */}
                <Route
                  path={routes.personnelDepartment.salaryAdjustments.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentSalaryAdjustmentsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.salaryAdjustments.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentSalaryAdjustmentDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.promotions.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPromotionsList />
                    </Suspense>
                  }
                />
                {/* Promotions simulation route - under promotions domain */}
                <Route
                  path={routes.personnelDepartment.promotions.simulation}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPromotionsSimulation />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.promotions.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentPromotionDetails />
                    </Suspense>
                  }
                />
                {/* Departamento Pessoal — Benefícios */}
                <Route
                  path={routes.personnelDepartment.benefits.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentBenefitsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.benefits.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentBenefitsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.benefits.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentBenefitsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.benefits.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentBenefitsDetails />
                    </Suspense>
                  }
                />
                {/* Departamento Pessoal — Adesões de Benefícios */}
                <Route
                  path={routes.personnelDepartment.benefits.enrollments.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentBenefitEnrollmentsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.benefits.enrollments.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentBenefitEnrollmentsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.benefits.enrollments.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentBenefitEnrollmentsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personnelDepartment.benefits.enrollments.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonnelDepartmentBenefitEnrollmentsDetails />
                    </Suspense>
                  }
                />
                {/* Medicina do Trabalho — ASO */}
                <Route
                  path={routes.occupationalHealth.medicalExams.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthMedicalExamsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.medicalExams.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthMedicalExamsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.medicalExams.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthMedicalExamsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.medicalExams.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthMedicalExamsDetails />
                    </Suspense>
                  }
                />
                {/* Medicina do Trabalho — Exames Periódicos */}
                <Route
                  path={routes.occupationalHealth.periodicExams.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthPeriodicExams />
                    </Suspense>
                  }
                />
                {/* Medicina do Trabalho — FISPQ / FDS */}
                <Route
                  path={routes.occupationalHealth.fispq.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthFispqList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.fispq.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthFispqCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.fispq.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthFispqEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.fispq.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthFispqDetails />
                    </Suspense>
                  }
                />
                {/* Medicina do Trabalho — Afastamentos */}
                <Route
                  path={routes.occupationalHealth.leaves.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthLeavesList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.leaves.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthLeavesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.leaves.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthLeavesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.leaves.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthLeavesDetails />
                    </Suspense>
                  }
                />
                {/* Medicina do Trabalho — CAT (Acidentes de Trabalho) */}
                <Route
                  path={routes.occupationalHealth.workAccidents.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthWorkAccidentsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.workAccidents.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthWorkAccidentsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.workAccidents.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthWorkAccidentsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.occupationalHealth.workAccidents.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OccupationalHealthWorkAccidentsEdit />
                    </Suspense>
                  }
                />

                {/* Catalog routes */}
                <Route
                  path={routes.catalog.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <CatalogList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.catalog.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <CatalogDetails />
                    </Suspense>
                  }
                />

                {/* Maintenance routes - Standalone */}
                <Route
                  path={routes.maintenance.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMaintenance />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.maintenance.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMaintenanceCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.maintenance.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMaintenanceEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.maintenance.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryMaintenanceDetails />
                    </Suspense>
                  }
                />

                {/* My Team routes */}
                <Route
                  path={routes.myTeam.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <MyTeam />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.myTeam.warnings}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <MyTeamWarnings />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.myTeam.loans}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <MyTeamLoans />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.myTeam.members}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <MyTeamMembers />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.myTeam.ppes}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <MyTeamPpes />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.myTeam.movements}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <MyTeamMovements />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.myTeam.calculations}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <MyTeamCalculations />
                    </Suspense>
                  }
                />

                {/* Server routes */}
                <Route
                  path={routes.server.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <Server />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.server.logs}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerLogs />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.server.metrics}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerMetrics />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.server.services}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerServices />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.server.backup}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerBackup />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.server.databaseSync}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerDatabaseSync />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.server.deployments.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerDeployments />
                    </Suspense>
                  }
                />
                <Route
                  path="/servidor/implantacoes/detalhes/:id"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerDeploymentDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.server.fileManager}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerFileManager />
                    </Suspense>
                  }
                />
                <Route
                  path="/servidor/gerenciador-de-arquivos/*"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerFileManager />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.server.users.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerUsers />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.server.throttler.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerRateLimiting />
                    </Suspense>
                  }
                />

                {/* Tools routes */}
                <Route
                  path={routes.tools.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ToolsHubPage />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.tools.qrCode.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <QrCodeToolPage />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.tools.colorPalette.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ColorPalettePage />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.tools.timeCalculator.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <TimeCalculatorPage />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.tools.overtimeCost.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OvertimeCostCalculatorPage />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.tools.employeeCost.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <EmployeeCostCalculatorPage />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.tools.paintMix.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PaintMixCalculatorPage />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.tools.wasteCertificate.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <WasteCertificateToolPage />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.tools.postIts.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PostItsPage />
                    </Suspense>
                  }
                />
              </Route>

                            {/* Universal link / Deep link routes */}
                            {/* These handle URLs like /app/task/123 from iOS/Android universal links */}
                            <Route path="/app/:entityType/:id" element={<DeepLinkRedirect />} />
                            <Route path="/app/:entityType" element={<DeepLinkRedirect />} />
                            {/* Also handle direct entity routes like /task/123 */}
                            <Route path="/task/:id" element={<DeepLinkRedirect />} />
                            <Route path="/order/:id" element={<DeepLinkRedirect />} />
                            <Route path="/item/:id" element={<DeepLinkRedirect />} />
                            <Route path="/service-order/:id" element={<DeepLinkRedirect />} />
                            <Route path="/user/:id" element={<DeepLinkRedirect />} />
                            <Route path="/customer/:id" element={<DeepLinkRedirect />} />
                            <Route path="/supplier/:id" element={<DeepLinkRedirect />} />
                            <Route path="/borrow/:id" element={<DeepLinkRedirect />} />
                            <Route path="/maintenance/:id" element={<DeepLinkRedirect />} />
                            <Route path="/financial/:id" element={<DeepLinkRedirect />} />
                            <Route path="/notification/:id" element={<DeepLinkRedirect />} />

                            {/* 404 Not Found route */}
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                          </PricingVisibilityBoundary>
                        </MessageModalProvider>
                      </FileViewerProvider>
                    </FavoritesProvider>
                    </PricingProvider>
                  </SidebarProvider>
                </AuthProvider>
              }
            />
          </Routes>
          </ErrorBoundary>
        </TooltipProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
