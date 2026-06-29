import { UserDetailPage } from "@/components/administration/user/detail-page";

// Collaborator (Colaborador) detail page, migrated onto the generic DetailPage base
// (`@/components/ui/detailpage`). The component itself wraps content in PrivilegeRoute and
// calls usePageTracker — see `user-detail-page.tsx`.
const CollaboratorDetailsPage = () => {
  return <UserDetailPage />;
};

export default CollaboratorDetailsPage;
