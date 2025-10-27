import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { routes } from "./constants";
import { ThemeProvider } from "@/contexts/theme-context";
import { AuthProvider } from "@/contexts/auth-context";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { FileViewerProvider } from "@/components/file/file-viewer";
import { AutoPrivilegeRoute } from "@/components/navigation/auto-privilege-route";
import { MainLayout } from "@/layouts/main-layout";
import { AuthLayout } from "@/layouts/auth-layout";
import { Toaster } from "@/components/ui/sonner";
import { setupWebNotifications } from "@/lib/setup-notifications";

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

// Favorites
const FavoritesPage = lazy(() => import("@/pages/favorites").then((module) => ({ default: module.FavoritesPage })));

// Profile
const ProfilePage = lazy(() => import("@/pages/profile").then((module) => ({ default: module.ProfilePage })));

// Administration
const Administration = lazy(() => import("@/pages/administration/root").then((module) => ({ default: module.AdministrationRootPage })));

const AdministrationCustomers = lazy(() => import("@/pages/administration/customers/list").then((module) => ({ default: module.CustomerListPage })));

// Financeiro
const FinanceiroClientesList = lazy(() => import("@/pages/financeiro/clientes/list").then((module) => ({ default: module.FinanceiroClientesListPage })));
const AdministrationCustomersCreate = lazy(() => import("@/pages/administration/customers/create").then((module) => ({ default: module.CreateCustomerPage })));
const AdministrationCustomersEdit = lazy(() => import("@/pages/administration/customers/edit/[id]").then((module) => ({ default: module.EditCustomerPage })));
const AdministrationCustomersDetails = lazy(() => import("@/pages/administration/customers/details/[id]").then((module) => ({ default: module.CustomerDetailsPage })));
const AdministrationCustomersBatchEdit = lazy(() => import("@/pages/administration/customers/batch-edit").then((module) => ({ default: module.CustomerBatchEditPage })));

const AdministrationCollaboratorsList = lazy(() => import("@/pages/administration/collaborators/list").then((module) => ({ default: module.default })));
const AdministrationCollaboratorsCreate = lazy(() => import("@/pages/administration/collaborators/create").then((module) => ({ default: module.default })));
const AdministrationCollaboratorsEdit = lazy(() => import("@/pages/administration/collaborators/edit/[id]").then((module) => ({ default: module.default })));
const AdministrationCollaboratorsDetails = lazy(() => import("@/pages/administration/collaborators/details/[id]").then((module) => ({ default: module.default })));
const AdministrationCollaboratorsBatchEdit = lazy(() => import("@/pages/administration/collaborators/batch-edit").then((module) => ({ default: module.default })));


const HumanResourcesPayrollList = lazy(() => import("@/pages/human-resources/folha-de-pagamento/list").then((module) => ({ default: module.default })));
const HumanResourcesPayrollDetail = lazy(() => import("@/pages/human-resources/folha-de-pagamento/detail").then((module) => ({ default: module.default })));
const HumanResourcesBonusSimulation = lazy(() => import("@/pages/human-resources/simulacao-bonus").then((module) => ({ default: module.default })));

const AdministrationSectorsList = lazy(() => import("@/pages/administration/sectors/list").then((module) => ({ default: module.SectorListPage })));
const AdministrationSectorsCreate = lazy(() => import("@/pages/administration/sectors/create").then((module) => ({ default: module.SectorCreatePage })));
const AdministrationSectorsEdit = lazy(() => import("@/pages/administration/sectors/edit/[id]").then((module) => ({ default: module.SectorEditPage })));
const AdministrationSectorsDetails = lazy(() => import("@/pages/administration/sectors/details/[id]").then((module) => ({ default: module.SectorDetailPage })));
const AdministrationSectorsBatchEdit = lazy(() => import("@/pages/administration/sectors/batch-edit").then((module) => ({ default: module.SectorBatchEditPage })));

const AdministrationNotifications = lazy(() => import("@/pages/administration/notifications/list").then((module) => ({ default: module.NotificationListPage })));
const AdministrationNotificationsEdit = lazy(() => import("@/pages/administration/notifications/edit/[id]").then((module) => ({ default: module.EditNotificationPage })));
const AdministrationNotificationsDetails = lazy(() => import("@/pages/administration/notifications/details/[id]").then((module) => ({ default: module.NotificationDetailsPage })));
const AdministrationNotificationsSend = lazy(() => import("@/pages/administration/notifications/create").then((module) => ({ default: module.CreateNotificationPage })));

const AdministrationChangeLogs = lazy(() => import("@/pages/administration/change-logs/list").then((module) => ({ default: module.default })));
const AdministrationChangeLogsDetails = lazy(() => import("@/pages/administration/change-logs/details/[id]").then((module) => ({ default: module.ChangeLogDetails })));

// Under Construction Page
const UnderConstruction = lazy(() => import("@/pages/under-construction"));

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
const InventoryExternalWithdrawals = lazy(() => import("@/pages/inventory/external-withdrawals/list").then((module) => ({ default: module.ExternalWithdrawalListPage })));
const InventoryExternalWithdrawalsCreate = lazy(() => import("@/pages/inventory/external-withdrawals/create").then((module) => ({ default: module.ExternalWithdrawalCreate })));
const InventoryExternalWithdrawalsEdit = lazy(() => import("@/pages/inventory/external-withdrawals/edit/[id]").then((module) => ({ default: module.ExternalWithdrawalEditPage })));
const InventoryExternalWithdrawalsDetails = lazy(() => import("@/pages/inventory/external-withdrawals/details/[id]").then((module) => ({ default: module.default })));

const InventoryOrders = lazy(() => import("@/pages/inventory/orders/list").then((module) => ({ default: module.OrderListPage })));
const InventoryOrdersCreate = lazy(() => import("@/pages/inventory/orders/create").then((module) => ({ default: module.CreateOrderPage })));
const InventoryOrdersEdit = lazy(() => import("@/pages/inventory/orders/edit/[id]").then((module) => ({ default: module.EditOrderPage })));
const InventoryOrdersDetails = lazy(() => import("@/pages/inventory/orders/details/[id]").then((module) => ({ default: module.default })));
const InventoryOrdersSchedules = lazy(() => import("@/pages/inventory/orders/schedules/list").then((module) => ({ default: module.OrderScheduleListPage })));
const InventoryOrdersSchedulesCreate = lazy(() => import("@/pages/inventory/orders/schedules/create").then((module) => ({ default: module.OrderScheduleCreate })));
const InventoryOrdersSchedulesEdit = lazy(() => import("@/pages/inventory/orders/schedules/edit/[id]").then((module) => ({ default: module.OrderScheduleEditPage })));
const InventoryOrdersAutomatic = lazy(() => import("@/pages/inventory/orders/automatic/list").then((module) => ({ default: module.AutomaticOrderListPage })));
const InventoryOrdersAutomaticConfigure = lazy(() => import("@/pages/inventory/orders/automatic/configure").then((module) => ({ default: module.AutomaticOrderConfigurePage })));

const InventoryProducts = lazy(() => import("@/pages/inventory/products/list").then((module) => ({ default: module.ProductListPage })));
const InventoryProductsCreate = lazy(() => import("@/pages/inventory/products/create").then((module) => ({ default: module.CreateProductPage })));
const InventoryProductsEdit = lazy(() => import("@/pages/inventory/products/edit/[id]").then((module) => ({ default: module.EditProductPage })));
const InventoryProductsDetails = lazy(() => import("@/pages/inventory/products/details/[id]").then((module) => ({ default: module.default })));
const InventoryProductsBatchEdit = lazy(() => import("@/pages/inventory/products/batch-edit").then((module) => ({ default: module.default })));
const InventoryProductsStockBalance = lazy(() => import("@/pages/inventory/products/stock-balance").then((module) => ({ default: module.default })));
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

// Personal
const Personal = lazy(() => import("@/pages/personal/root").then((module) => ({ default: module.Personal })));
const PersonalMyProfile = lazy(() => import("@/pages/personal/my-profile").then((module) => ({ default: module.MyProfilePage })));
const PersonalMyLoans = lazy(() => import("@/pages/personal/my-loans").then((module) => ({ default: module.MyLoansPage })));
const PersonalMyPpes = lazy(() => import("@/pages/personal/my-ppes").then((module) => ({ default: module.MyPpesPage })));
const PersonalMyPpesRequest = lazy(() => import("@/pages/personal/my-ppes").then((module) => ({ default: module.PersonalMyPpesRequest })));

const PersonalMyHolidays = lazy(() => import("@/pages/personal/my-holidays").then((module) => ({ default: module.MyHolidaysPage })));
const PersonalMyVacations = lazy(() => import("@/pages/personal/my-vacations").then((module) => ({ default: module.MyVacationsPage })));
const PersonalMyNotifications = lazy(() => import("@/pages/personal/my-notifications").then((module) => ({ default: module.MyNotificationsPage })));
const PersonalPreferences = lazy(() => import("@/pages/personal/preferences").then((module) => ({ default: module.PreferencesPage })));
const PersonalMyWarnings = lazy(() => import("@/pages/personal/my-warnings").then((module) => ({ default: module.MyWarningsPage })));

// Paint
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

// Production
const Production = lazy(() => import("@/pages/production/root").then((module) => ({ default: module.ProductionRootPage })));
const ProductionObservations = lazy(() => import("@/pages/production/observations/list").then((module) => ({ default: module.ObservationsList })));
const ProductionObservationsCreate = lazy(() => import("@/pages/production/observations/create").then((module) => ({ default: module.ObservationCreate })));
const ProductionObservationsEdit = lazy(() => import("@/pages/production/observations/edit/[id]").then((module) => ({ default: module.ObservationEdit })));
const ProductionObservationsDetails = lazy(() => import("@/pages/production/observations/details/[id]").then((module) => ({ default: module.ObservationDetailsPage })));

// Airbrushing routes
const ProductionAirbrushing = lazy(() => import("@/pages/production/aerografia/list").then((module) => ({ default: module.AirbrushingListPage })));
const ProductionAirbrushingCreate = lazy(() => import("@/pages/production/aerografia/cadastrar").then((module) => ({ default: module.AirbrushingCreate })));
const ProductionAirbrushingEdit = lazy(() => import("@/pages/production/aerografia/edit/[id]").then((module) => ({ default: module.AirbrushingEdit })));
const ProductionAirbrushingDetails = lazy(() => import("@/pages/production/aerografia/details/[id]").then((module) => ({ default: module.AirbrushingDetails })));
const ProductionGarages = lazy(() => import("@/pages/production/garages"));
const ProductionCutting = lazy(() => import("@/pages/production/cutting/list").then((module) => ({ default: module.default })));
const ProductionCuttingDetails = lazy(() => import("@/pages/production/cutting/details/[id]").then((module) => ({ default: module.CuttingDetailsPage })));

// Production Tasks
const ProductionTasksList = lazy(() => import("@/pages/production/cronograma/list").then((module) => ({ default: module.TaskListPage })));
const ProductionTasksHistory = lazy(() => import("@/pages/production/history").then((module) => ({ default: module.TaskHistoryPage })));
const ProductionTasksBatchEdit = lazy(() => import("@/pages/production/cronograma/batch-edit"));
const ProductionTasksCreate = lazy(() => import("@/pages/production/cronograma/create"));
const ProductionTasksEdit = lazy(() => import("@/pages/production/cronograma/edit/[id]").then((module) => ({ default: module.TaskEditPage })));
const ProductionTasksDetails = lazy(() => import("@/pages/production/cronograma/details/[id]").then((module) => ({ default: module.TaskDetailsPage })));
const ProductionScheduleOnHold = lazy(() => import("@/pages/production/schedule-on-hold").then((module) => ({ default: module.ScheduleOnHoldPage })));

// Human Resources
const HumanResources = lazy(() => import("@/pages/human-resources/root").then((module) => ({ default: module.HumanResourcesRootPage })));
const HumanResourcesWarningsList = lazy(() => import("@/pages/human-resources/warnings/list").then((module) => ({ default: module.WarningListPage })));
const HumanResourcesWarningsCreate = lazy(() => import("@/pages/human-resources/warnings/create").then((module) => ({ default: module.WarningCreatePage })));
const HumanResourcesWarningsEdit = lazy(() => import("@/pages/human-resources/warnings/edit/[id]").then((module) => ({ default: module.WarningEditPage })));
const HumanResourcesWarningsDetails = lazy(() => import("@/pages/human-resources/warnings/details/[id]").then((module) => ({ default: module.WarningDetailPage })));
const HumanResourcesPositions = lazy(() => import("@/pages/human-resources/positions/list").then((module) => ({ default: module.PositionListPage })));
const HumanResourcesPositionsCreate = lazy(() => import("@/pages/human-resources/positions/create").then((module) => ({ default: module.PositionCreatePage })));
const HumanResourcesPositionsEdit = lazy(() => import("@/pages/human-resources/positions/edit/[id]").then((module) => ({ default: module.PositionEditPage })));
const HumanResourcesPositionsDetails = lazy(() => import("@/pages/human-resources/positions/details/[id]").then((module) => ({ default: module.PositionDetailPage })));
const HumanResourcesPositionsHierarchy = lazy(() => import("@/pages/human-resources/positions/hierarchy").then((module) => ({ default: module.PositionHierarchyPage })));
const HumanResourcesPositionsBatchEdit = lazy(() => import("@/pages/human-resources/positions/batch-edit").then((module) => ({ default: module.PositionBatchEditPage })));
// Note: Employees pages are managed under Administration section, not Human Resources
const HumanResourcesPpe = lazy(() => import("@/pages/human-resources/ppe/list").then((module) => ({ default: module.PpeListPage })));
const HumanResourcesPpeCreate = lazy(() => import("@/pages/human-resources/ppe/create").then((module) => ({ default: module.CreateEpiPage })));
const HumanResourcesPpeEdit = lazy(() => import("@/pages/human-resources/ppe/edit/[id]").then((module) => ({ default: module.EditEpiPage })));
const HumanResourcesPpeDetails = lazy(() => import("@/pages/human-resources/ppe/details/[id]").then((module) => ({ default: module.default })));
const HumanResourcesPpeDeliveries = lazy(() => import("@/pages/human-resources/ppe/deliveries/list").then((module) => ({ default: module.PpeDeliveryListPage })));
const HumanResourcesPpeDeliveriesCreate = lazy(() => import("@/pages/human-resources/ppe/deliveries/create").then((module) => ({ default: module.EPIDeliveryCreate })));
const HumanResourcesPpeDeliveriesEdit = lazy(() => import("@/pages/human-resources/ppe/deliveries/edit/[id]").then((module) => ({ default: module.EPIDeliveryEdit })));
const HumanResourcesPpeDeliveriesDetails = lazy(() => import("@/pages/human-resources/ppe/deliveries/details/[id]").then((module) => ({ default: module.EPIDeliveryDetails })));
const HumanResourcesPpeSizes = lazy(() => import("@/pages/human-resources/ppe/sizes/list").then((module) => ({ default: module.PpeSizeListPage })));
const HumanResourcesPpeSizesCreate = lazy(() => import("@/pages/human-resources/ppe/sizes/create").then((module) => ({ default: module.PpeSizeCreate })));
const HumanResourcesPpeSizesEdit = lazy(() => import("@/pages/human-resources/ppe/sizes/edit/[id]").then((module) => ({ default: module.PpeSizeEditPage })));
const HumanResourcesPpeSchedules = lazy(() => import("@/pages/human-resources/ppe/schedules/list").then((module) => ({ default: module.PPESchedulesListPage })));
const HumanResourcesPpeSchedulesCreate = lazy(() => import("@/pages/human-resources/ppe/schedules/create").then((module) => ({ default: module.PPEScheduleCreatePage })));
const HumanResourcesPpeSchedulesEdit = lazy(() => import("@/pages/human-resources/ppe/schedules/edit/[id]").then((module) => ({ default: module.PPEScheduleEditPage })));
const HumanResourcesPpeSchedulesDetails = lazy(() => import("@/pages/human-resources/ppe/schedules/details/[id]").then((module) => ({ default: module.PPEScheduleDetailsPage })));
const HumanResourcesCalculations = lazy(() => import("@/pages/human-resources/calculations/list").then((module) => ({ default: module.default })));
const HumanResourcesRequisicoes = lazy(() => import("@/pages/human-resources/requisicoes/list").then((module) => ({ default: module.default })));
const HumanResourcesHolidays = lazy(() => import("@/pages/human-resources/holidays/list").then((module) => ({ default: module.HolidayListPage })));
const HumanResourcesHolidaysCalendar = lazy(() => import("@/pages/human-resources/holidays/calendar").then((module) => ({ default: module.HolidayCalendarPage })));
const HumanResourcesHolidaysCreate = lazy(() => import("@/pages/human-resources/holidays/cadastrar").then((module) => ({ default: module.HolidayCreatePage })));
const HumanResourcesVacations = lazy(() => import("@/pages/human-resources/vacations/list").then((module) => ({ default: module.VacationListPage })));
const HumanResourcesVacationsCreate = lazy(() => import("@/pages/human-resources/vacations/create").then((module) => ({ default: module.CreateVacationPage })));
const HumanResourcesVacationsDetails = lazy(() => import("@/pages/human-resources/vacations/details/[id]").then((module) => ({ default: module.VacationDetailsPage })));
const HumanResourcesVacationsEdit = lazy(() => import("@/pages/human-resources/vacations/edit/[id]").then((module) => ({ default: module.EditVacationPage })));
const HumanResourcesVacationsCalendar = lazy(() => import("@/pages/human-resources/vacations/calendar").then((module) => ({ default: module.VacationCalendarPage })));
const HumanResourcesTimeClock = lazy(() => import("@/pages/human-resources/time-clock/list"));
const HumanResourcesPerformanceLevels = lazy(() => import("@/pages/human-resources/performance-levels/list").then((module) => ({ default: module.default })));

// Catalog
const CatalogList = lazy(() => import("@/pages/catalog/list").then((module) => ({ default: module.default })));
const CatalogDetails = lazy(() => import("@/pages/catalog/details/[id]").then((module) => ({ default: module.default })));

// Maintenance
const Maintenance = lazy(() => import("@/pages/maintenance/index").then((module) => ({ default: module.default })));
const MaintenanceDetails = lazy(() => import("@/pages/maintenance/details/[id]").then((module) => ({ default: module.default })));

// My Team
const MyTeam = lazy(() => import("@/pages/my-team/index").then((module) => ({ default: module.default })));
const MyTeamVacations = lazy(() => import("@/pages/my-team/vacations").then((module) => ({ default: module.default })));
const MyTeamWarnings = lazy(() => import("@/pages/my-team/warnings").then((module) => ({ default: module.default })));
const MyTeamLoans = lazy(() => import("@/pages/my-team/loans").then((module) => ({ default: module.default })));

// Server
const Server = lazy(() => import("@/pages/server/root").then((module) => ({ default: module.ServerRootPage })));
const ServerBackup = lazy(() => import("@/pages/admin/backup").then((module) => ({ default: module.BackupManagementPage })));
const ServerDatabaseSync = lazy(() => import("@/pages/server/database-sync").then((module) => ({ default: module.DatabaseSyncPage })));
const ServerDeployments = lazy(() => import("@/pages/server/deployments").then((module) => ({ default: module.DeploymentListPage })));
const ServerDeploymentDetails = lazy(() => import("@/pages/server/deployments/[id]").then((module) => ({ default: module.DeploymentDetailPage })));
const ServerLogs = lazy(() => import("@/pages/server/logs").then((module) => ({ default: module.ServerLogsPage })));
const ServerMetrics = lazy(() => import("@/pages/server/metrics").then((module) => ({ default: module.ServerMetricsPage })));
const ServerServices = lazy(() => import("@/pages/server/services").then((module) => ({ default: module.ServerServicesPage })));
const ServerSharedFolders = lazy(() => import("@/pages/server/shared-folders").then((module) => ({ default: module.ServerSharedFoldersPage })));
const ServerUsers = lazy(() => import("@/pages/server/users").then((module) => ({ default: module.ServerUsersPage })));
const ServerRateLimiting = lazy(() => import("@/pages/server/rate-limiting").then((module) => ({ default: module.RateLimitingPage })));

function App() {
  // Initialize web notifications
  useEffect(() => {
    setupWebNotifications();
  }, []);

  return (
    <Router>
      <ThemeProvider defaultTheme="light" storageKey="ankaa-ui-theme">
        <AuthProvider>
          <FavoritesProvider>
            <FileViewerProvider>
              <Toaster />
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

                {/* Profile route */}
                <Route
                  path="/perfil"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProfilePage />
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
                  path={routes.production.schedule.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTasksBatchEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.schedule.create}
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
                  path={routes.production.schedule.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTasksDetails />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.production.scheduleOnHold.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionScheduleOnHold />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.production.scheduleOnHold.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionTasksDetails />
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
                      <ProductionTasksDetails />
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
                  path="/production/garages/*"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionGarages />
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

                {/* Administration routes */}
                <Route
                  path={routes.administration.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <Administration />
                    </Suspense>
                  }
                />


                <Route
                  path={routes.administration.customers.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationCustomers />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.customers.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationCustomersCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.customers.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationCustomersEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.customers.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationCustomersDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.administration.customers.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdministrationCustomersBatchEdit />
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
                  path={routes.humanResources.payroll.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPayrollList />
                    </Suspense>
                  }
                />
                {/* Payroll detail route by ID */}
                <Route
                  path="/recursos-humanos/folha-de-pagamento/detalhe/:payrollId"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPayrollDetail />
                    </Suspense>
                  }
                />
                {/* Bonus simulation route */}
                <Route
                  path={routes.humanResources.bonus.simulation}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesBonusSimulation />
                    </Suspense>
                  }
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

                {/* Financeiro routes */}
                <Route
                  path="/financeiro/clientes"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <FinanceiroClientesList />
                    </Suspense>
                  }
                />

                {/* Statistics routes - Under Construction */}
                <Route
                  path="/estatisticas/*"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <UnderConstruction />
                    </Suspense>
                  }
                />

                {/* Redirect from old inventory statistics route */}
                <Route
                  path="/estoque/estatisticas"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <UnderConstruction />
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

                {/* External Withdrawals routes */}
                <Route
                  path={routes.inventory.externalWithdrawals.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryExternalWithdrawals />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.externalWithdrawals.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryExternalWithdrawalsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.externalWithdrawals.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryExternalWithdrawalsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.inventory.externalWithdrawals.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryExternalWithdrawalsDetails />
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
                  path={routes.personal.myProfile.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalMyProfile />
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
                  path={routes.personal.myHolidays.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalMyHolidays />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personal.myVacations.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalMyVacations />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.personal.myNotifications.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalMyNotifications />
                    </Suspense>
                  }
                />

                <Route
                  path={routes.personal.preferences.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PersonalPreferences />
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

                {/* Human Resources routes */}
                <Route
                  path={routes.humanResources.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResources />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.warnings.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesWarningsList />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.warnings.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesWarningsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.warnings.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesWarningsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.warnings.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesWarningsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.positions.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPositions />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.positions.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPositionsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.positions.hierarchy}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPositionsHierarchy />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.positions.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPositionsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.positions.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPositionsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.positions.batchEdit}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPositionsBatchEdit />
                    </Suspense>
                  }
                />
                {/* Note: employees routes are under administration.employees, not humanResources */}
                <Route
                  path={routes.humanResources.ppe.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpe />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.deliveries.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeDeliveries />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.deliveries.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeDeliveriesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.deliveries.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeDeliveriesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.deliveries.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeDeliveriesDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.sizes.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeSizes />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.sizes.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeSizesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.sizes.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeSizesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.schedules.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeSchedules />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.schedules.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeSchedulesCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.schedules.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeSchedulesEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.ppe.schedules.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPpeSchedulesDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.calculations.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesCalculations />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.requisicoes.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesRequisicoes />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.holidays.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesHolidays />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.holidays.calendar}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesHolidaysCalendar />
                    </Suspense>
                  }
                />
                <Route
                  path="/recursos-humanos/feriados/cadastrar"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesHolidaysCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.vacations.root}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesVacations />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.vacations.create}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesVacationsCreate />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.vacations.details(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesVacationsDetails />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.vacations.edit(":id")}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesVacationsEdit />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.vacations.calendar}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesVacationsCalendar />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.timeClock.list}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesTimeClock />
                    </Suspense>
                  }
                />
                <Route
                  path={routes.humanResources.performanceLevels.list}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <HumanResourcesPerformanceLevels />
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
                      <Maintenance />
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
                      <MaintenanceDetails />
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
                  path={routes.myTeam.vacations}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <MyTeamVacations />
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
                  path={routes.server.sharedFolders}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerSharedFolders />
                    </Suspense>
                  }
                />
                <Route
                  path="/servidor/pastas-compartilhadas/*"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ServerSharedFolders />
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
              </Route>

              {/* 404 Not Found route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </FileViewerProvider>
          </FavoritesProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
