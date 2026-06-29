import { useCallback, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import {
  IconUser,
  IconId,
  IconMail,
  IconPhone,
  IconBrandWhatsapp,
  IconCake,
  IconShieldCheck,
  IconMapPin,
  IconExternalLink,
  IconCertificate,
  IconBuilding,
  IconBriefcase,
  IconUserCog,
  IconHash,
  IconCalendarTime,
  IconCalendarShare,
  IconCalendarCheck,
  IconCalendarCancel,
  IconLogin,
  IconKey,
  IconClock,
  IconShirt,
  IconShoe,
  IconHanger,
  IconMask,
  IconHandGrab,
  IconUmbrella,
  IconHistory,
  IconEdit,
  IconTrash,
  IconLoader2,
  IconAlertTriangle,
  IconCertificate2,
  IconGift,
  IconUsers,
  IconCreditCard,
} from "@tabler/icons-react";

import { DetailPage } from "@/components/ui/detailpage";
import type { DetailSectionDef } from "@/components/ui/detailpage";
import type { PageAction } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatarDisplay } from "@/components/ui/avatar-display";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";

import { useUser, useUserMutations } from "@/hooks";
import { getPositions } from "@/api-client/position";
import { getSectors } from "@/api-client/sector";
import { useAuth } from "@/contexts/auth-context";
import { useNavBreadcrumbs } from "@/contexts/navigation-context";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { canEditUsers, canDeleteUsers } from "@/utils/permissions/entity-permissions";
import {
  formatBrazilianPhone,
  formatDateTime,
  formatRelativeTime,
  maskCNPJ,
  getCollaboratorStatus,
} from "@/utils";
import {
  routes,
  SECTOR_PRIVILEGES,
  CHANGE_LOG_ENTITY_TYPE,
  EMPLOYEE_TYPE,
  VERIFICATION_TYPE_LABELS,
  SHIRT_SIZE_LABELS,
  BOOT_SIZE_LABELS,
  PANTS_SIZE_LABELS,
  SLEEVES_SIZE_LABELS,
  MASK_SIZE_LABELS,
  GLOVES_SIZE_LABELS,
  RAIN_BOOTS_SIZE_LABELS,
} from "@/constants";
import type { User } from "@/types";

import { RelatedActivitiesCard } from "@/components/administration/user/detail/related-activities-card";
import { UserDocumentationCard } from "@/components/personnel-department/admission/user-documentation-card";
import { UserBenefitsCard } from "@/components/personnel-department/user-benefit/user-benefits-card";
import { DependentsCard } from "@/components/personnel-department/dependent/dependents-card";
import { CollaboratorLoansCard } from "@/components/personnel-department/collaborator-loans-card";
import { CollaboratorThirteenthCard } from "@/components/personnel-department/collaborator-thirteenth-card";
import { ChangelogHistory } from "@/components/ui/changelog-history";

// Audience for the page — mirrors the legacy collaborator-detail PrivilegeRoute.
const PAGE_PRIVILEGES = [
  SECTOR_PRIVILEGES.ADMIN,
  SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  SECTOR_PRIVILEGES.ACCOUNTING,
  SECTOR_PRIVILEGES.HUMAN_RESOURCES,
];

// Sensitive sections (login / payroll). Viewable + editable only by Departamento Pessoal
// (HR / Contabilidade) + ADMIN — Production Manager can see the page but not these. Matches
// `canEditUsers` (HR/ACCOUNTING/ADMIN), so it doubles as the inline-edit gate.
const HR_ACC_ADMIN = [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.ADMIN];

// Map a collaborator-status variant onto the (narrower) header status-badge variant set.
function headerStatusVariant(v: ReturnType<typeof getCollaboratorStatus>["variant"]): "default" | "secondary" | "destructive" | "outline" {
  if (v === "red") return "destructive";
  if (v === "gray") return "secondary";
  return "default";
}

/** WhatsApp deep-link for a raw BR phone number (prefixes 55 when missing). */
function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

function PhoneValue({ phone }: { phone: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-3">
      <a href={`tel:${phone}`} className="font-mono font-semibold text-green-600 hover:underline dark:text-green-600">
        {formatBrazilianPhone(phone)}
      </a>
      <a
        href={whatsappHref(phone)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-green-600 transition-colors hover:text-green-700 dark:text-green-600 dark:hover:text-green-500"
        title="Enviar mensagem no WhatsApp"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <IconBrandWhatsapp className="h-5 w-5" />
      </a>
    </span>
  );
}

export function UserDetailPage() {
  return (
    <PrivilegeRoute requiredPrivilege={PAGE_PRIVILEGES}>
      <UserDetailContent />
    </PrivilegeRoute>
  );
}

function UserDetailContent() {
  usePageTracker({ title: "Detalhes do Colaborador" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const canEdit = canEditUsers(currentUser);
  const canDelete = canDeleteUsers(currentUser);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: response,
    isLoading,
    error,
  } = useUser(id || "", {
    include: {
      position: true,
      sector: true,
      ledSector: true,
      ppeSize: true,
      avatar: true,
      currentContract: true,
      activities: { include: { item: true } },
      changeLogs: true,
    },
    enabled: !!id,
  });

  const user = response?.data;
  const mutations = useUserMutations();

  // Hide-empty for self-hiding embedded sections. The base auto-hides a section
  // only when its `render` returns null, but the embedded cards return a truthy
  // element and self-hide INTERNALLY — invisible to the base. So each optional
  // card reports its real (filtered) record count via `onCount`, and we drop the
  // section from the array when the count is exactly 0 (undefined/null = loading,
  // keep it visible). `_count` on the user is NOT usable here because the cards
  // apply their own filters (benefits → ACTIVE only, loans → LOAN/ADVANCE), so a
  // raw relation count would leave genuinely-empty sections showing.
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const reportCount = useCallback((sectionId: string, n: number | null) => {
    setCounts((c) => (c[sectionId] === n ? c : { ...c, [sectionId]: n }));
  }, []);

  // Payroll loans / advances only apply to CLT vínculos.
  const isCltCollaborator =
    (user?.currentContract?.employeeType ?? (user as unknown as { currentEmployeeType?: EMPLOYEE_TYPE })?.currentEmployeeType) ===
    EMPLOYEE_TYPE.CLT;

  // Context-aware trail (shared page). Called unconditionally (no early returns before hooks).
  const breadcrumbs = useNavBreadcrumbs(
    [
      { label: "Início", href: "/" },
      { label: "Administração", href: routes.administration.root },
      { label: "Colaboradores", href: routes.administration.collaborators.root },
      { label: user?.name ?? "Detalhes" },
    ],
    { leaf: [{ label: user?.name ?? "Detalhes" }] },
  );

  const setUserField = async (patch: Record<string, unknown>) => {
    if (!id) return;
    await mutations.updateAsync({ id, data: patch as never });
  };

  // Async option loaders for the Cargo / Setor inline-edit comboboxes.
  const loadPositions = useCallback(async (search: string, page = 1) => {
    const limit = 100;
    const res = (await getPositions({ searchingFor: search, page, limit, orderBy: { name: "asc" } } as never)) as { data?: Array<{ id: string; name?: string }> };
    const out = (res?.data ?? []).map((p) => ({ value: p.id, label: p.name || p.id }));
    return { data: out, hasMore: out.length === limit };
  }, []);
  const loadSectors = useCallback(async (search: string, page = 1) => {
    const limit = 100;
    const res = (await getSectors({ searchingFor: search, page, limit, orderBy: { name: "asc" } } as never)) as { data?: Array<{ id: string; name?: string }> };
    const out = (res?.data ?? []).map((s) => ({ value: s.id, label: s.name || s.id }));
    return { data: out, hasMore: out.length === limit };
  }, []);

  const sections = useMemo<DetailSectionDef<User>[]>(() => {
    const textEdit = (key: keyof User) => ({
      get: (u: User) => (u[key] as string | null) ?? "",
      onCommit: (v: unknown) => setUserField({ [key]: (v as string) || null }),
    });

    // EPI sizes live on the nested `ppeSize` relation; a single-field edit re-sends the whole object
    // (the API replaces it) with just the one key changed. Display stays plain text; the editor is a
    // size combobox.
    const PPE_KEYS = ["shirts", "boots", "pants", "shorts", "sleeves", "mask", "gloves", "rainBoots"] as const;
    const ppeOpts = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
    const ppeEdit = (key: (typeof PPE_KEYS)[number], labels: Record<string, string>) => ({
      get: (u: User) => ((u.ppeSize?.[key] as string | null | undefined) ?? "") as string,
      onCommit: (v: unknown, u: User) => {
        const base: Record<string, string | null> = {};
        for (const k of PPE_KEYS) base[k] = (u.ppeSize?.[k] as string | null | undefined) ?? null;
        return setUserField({ ppeSize: { ...base, [key]: (v as string) || null } });
      },
      options: ppeOpts(labels),
    });

    return [
      // ---- Informações Básicas ------------------------------------------------
      {
        id: "basic-info",
        label: "Informações Básicas",
        icon: IconUser,
        span: 1,
        fields: [
          {
            id: "avatar",
            label: "Foto",
            block: true,
            render: (u) => (
              <div className="flex justify-center py-2">
                <UserAvatarDisplay avatar={u.avatar} userName={u.name} size="2xl" shape="rounded" bordered />
              </div>
            ),
          },
          {
            id: "name",
            label: "Nome",
            icon: IconId,
            editablePrivilege: HR_ACC_ADMIN,
            accessor: (u) => u.name,
            edit: textEdit("name"),
          },
          {
            id: "email",
            label: "E-mail",
            icon: IconMail,
            editablePrivilege: HR_ACC_ADMIN,
            accessor: (u) => u.email,
            render: (u) =>
              u.email ? (
                <a href={`mailto:${u.email}`} className="break-all font-semibold text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  {u.email}
                </a>
              ) : undefined,
            edit: { ...textEdit("email"), placeholder: "email@exemplo.com" },
          },
          {
            id: "phone",
            label: "Telefone",
            icon: IconPhone,
            dataType: "phone",
            editablePrivilege: HR_ACC_ADMIN,
            accessor: (u) => u.phone,
            render: (u) => (u.phone ? <PhoneValue phone={u.phone} /> : undefined),
            edit: textEdit("phone"),
          },
          {
            id: "birth",
            label: "Data de Nascimento",
            icon: IconCake,
            dataType: "date",
            editablePrivilege: HR_ACC_ADMIN,
            accessor: (u) => u.birth,
            edit: { get: (u) => u.birth, onCommit: (v) => setUserField({ birth: (v as Date) ?? null }) },
          },
          {
            id: "cpf",
            label: "CPF",
            icon: IconId,
            dataType: "cpf",
            editablePrivilege: HR_ACC_ADMIN,
            accessor: (u) => u.cpf,
            edit: textEdit("cpf"),
          },
          {
            id: "pis",
            label: "PIS",
            icon: IconCertificate,
            dataType: "pis",
            editablePrivilege: HR_ACC_ADMIN,
            accessor: (u) => u.pis,
            edit: textEdit("pis"),
          },
          {
            id: "providerCnpj",
            label: "CNPJ",
            icon: IconBuilding,
            dataType: "cnpj",
            // CNPJ de prestador (terceirizado/PJ) vive no vínculo atual, não no User.
            accessor: (u) => u.currentContract?.providerCnpj ?? null,
            render: (u) => {
              const cnpj = u.currentContract?.providerCnpj;
              if (!cnpj) return undefined;
              return (
                <span className="text-right">
                  <span className="block">{maskCNPJ(cnpj)}</span>
                  {u.currentContract?.providerName && <span className="block text-xs font-normal text-muted-foreground">{u.currentContract.providerName}</span>}
                </span>
              );
            },
          },
          {
            id: "situacao",
            label: "Situação",
            icon: IconShieldCheck,
            accessor: (u) => getCollaboratorStatus(u).label,
            // Single combined badge — identical to the collaborators TABLE's "Situação" column
            // (getCollaboratorStatus already folds contract type/duration into the label).
            render: (u) => {
              const s = getCollaboratorStatus(u);
              return (
                <span className="flex justify-end">
                  <Badge variant={s.variant}>{s.label}</Badge>
                </span>
              );
            },
          },
        ],
      },

      // ---- Dados Profissionais -----------------------------------------------
      {
        id: "professional-info",
        label: "Dados Profissionais",
        icon: IconBriefcase,
        span: 1,
        fields: [
          {
            id: "payrollNumber",
            label: "Número da Folha",
            icon: IconHash,
            dataType: "integer",
            requiredPrivilege: HR_ACC_ADMIN,
            editablePrivilege: HR_ACC_ADMIN,
            accessor: (u) => u.payrollNumber,
            edit: { get: (u) => u.payrollNumber, onCommit: (v) => setUserField({ payrollNumber: v === "" || v == null ? null : Number(v) }) },
          },
          {
            id: "position",
            label: "Cargo",
            icon: IconBriefcase,
            dataType: "relation",
            editablePrivilege: HR_ACC_ADMIN,
            accessor: (u) => u.position?.name ?? null,
            edit: {
              get: (u) => u.positionId ?? null,
              options: user?.position ? [{ value: user.position.id, label: user.position.name ?? user.position.id }] : undefined,
              loadOptions: loadPositions,
              onCommit: (v) => setUserField({ positionId: (v as string) || null }),
            },
          },
          {
            id: "sector",
            label: "Setor",
            icon: IconBuilding,
            dataType: "relation",
            editablePrivilege: HR_ACC_ADMIN,
            accessor: (u) => u.sector?.name ?? null,
            edit: {
              get: (u) => u.sectorId ?? null,
              options: user?.sector ? [{ value: user.sector.id, label: user.sector.name ?? user.sector.id }] : undefined,
              loadOptions: loadSectors,
              onCommit: (v) => setUserField({ sectorId: (v as string) || null }),
            },
          },
          { id: "ledSector", label: "Setor Liderado", icon: IconUserCog, accessor: (u) => u.ledSector?.name ?? null },
          {
            id: "exp1Start",
            label: "Início Experiência 1",
            icon: IconCalendarTime,
            dataType: "date",
            accessor: (u) => u.currentContract?.admissionDate ?? u.currentContract?.exp1StartAt ?? null,
          },
          { id: "exp1End", label: "Fim Experiência 1", icon: IconCalendarShare, dataType: "date", accessor: (u) => u.currentContract?.exp1EndAt ?? null },
          { id: "exp2Start", label: "Início Experiência 2", icon: IconCalendarTime, dataType: "date", accessor: (u) => u.currentContract?.exp2StartAt ?? null },
          { id: "exp2End", label: "Fim Experiência 2", icon: IconCalendarShare, dataType: "date", accessor: (u) => u.currentContract?.exp2EndAt ?? null },
          { id: "effectedAt", label: "Data de Efetivação", icon: IconCalendarCheck, dataType: "date", accessor: (u) => u.currentContract?.effectedAt ?? null },
          { id: "terminationDate", label: "Data de Demissão", icon: IconCalendarCancel, dataType: "date", accessor: (u) => u.currentContract?.terminationDate ?? null },
          {
            id: "performanceLevel",
            label: "Nível de Desempenho",
            dataType: "integer",
            editablePrivilege: HR_ACC_ADMIN,
            accessor: (u) => u.performanceLevel ?? 0,
            edit: {
              get: (u) => u.performanceLevel ?? 0,
              onCommit: (v) => setUserField({ performanceLevel: v === "" || v == null ? 0 : Number(v) }),
              min: 0,
              max: 5,
            },
          },
        ],
      },

      // ---- Endereço ----------------------------------------------------------
      {
        id: "address",
        label: "Endereço",
        icon: IconMapPin,
        span: 1,
        fields: [
          { id: "address", label: "Logradouro", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => u.address, edit: textEdit("address") },
          { id: "addressNumber", label: "Número", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => u.addressNumber, edit: textEdit("addressNumber") },
          { id: "addressComplement", label: "Complemento", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => u.addressComplement, edit: textEdit("addressComplement") },
          { id: "neighborhood", label: "Bairro", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => u.neighborhood, edit: textEdit("neighborhood") },
          { id: "city", label: "Cidade", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => u.city, edit: textEdit("city") },
          { id: "state", label: "Estado", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => u.state, edit: textEdit("state") },
          {
            id: "zipCode",
            label: "CEP",
            dataType: "cep",
            editablePrivilege: HR_ACC_ADMIN,
            accessor: (u) => u.zipCode,
            edit: textEdit("zipCode"),
          },
        ],
        render: (u) => {
          const parts = [u.address, u.addressNumber, u.neighborhood, u.city, u.state, u.zipCode].filter(Boolean);
          if (!parts.length) return null;
          const query = encodeURIComponent(parts.join(", "));
          return (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${query}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Abrir no Google Maps
              <IconExternalLink className="h-3.5 w-3.5" />
            </a>
          );
        },
      },

      // ---- Informações de Login (sensível) -----------------------------------
      {
        id: "login-info",
        label: "Informações de Login",
        icon: IconLogin,
        span: 1,
        requiredPrivilege: HR_ACC_ADMIN,
        fields: [
          {
            id: "verified",
            label: "Status de Verificação",
            icon: IconShieldCheck,
            accessor: (u) => (u.verified ? "Verificado" : "Não Verificado"),
            render: (u) => <Badge variant={u.verified ? "active" : "inactive"}>{u.verified ? "Verificado" : "Não Verificado"}</Badge>,
          },
          {
            id: "requirePasswordChange",
            label: "Alteração de Senha",
            icon: IconKey,
            accessor: (u) => (u.requirePasswordChange ? "Requerida" : "Não Requerida"),
            render: (u) => <Badge variant={u.requirePasswordChange ? "warning" : "active"}>{u.requirePasswordChange ? "Requerida" : "Não Requerida"}</Badge>,
          },
          {
            id: "lastLoginAt",
            label: "Último Acesso",
            icon: IconClock,
            accessor: (u) => u.lastLoginAt ?? null,
            render: (u) =>
              u.lastLoginAt ? (
                <span className="text-right">
                  <span className="block font-semibold">{formatDateTime(u.lastLoginAt)}</span>
                  <span className="block text-xs text-muted-foreground">{formatRelativeTime(u.lastLoginAt)}</span>
                </span>
              ) : undefined,
          },
          {
            id: "verificationType",
            label: "Tipo de Verificação",
            accessor: (u) =>
              u.verificationType ? VERIFICATION_TYPE_LABELS[u.verificationType as keyof typeof VERIFICATION_TYPE_LABELS] ?? u.verificationType : null,
          },
          { id: "verificationExpiresAt", label: "Expiração da Verificação", dataType: "datetime", accessor: (u) => u.verificationExpiresAt ?? null },
          {
            id: "createdAt",
            label: "Data de Criação",
            icon: IconClock,
            accessor: (u) => u.createdAt ?? null,
            render: (u) =>
              u.createdAt ? (
                <span className="text-right">
                  <span className="block font-semibold">{formatDateTime(u.createdAt)}</span>
                  <span className="block text-xs text-muted-foreground">{formatRelativeTime(u.createdAt)}</span>
                </span>
              ) : undefined,
          },
          {
            id: "updatedAt",
            label: "Última Atualização",
            icon: IconClock,
            accessor: (u) => u.updatedAt ?? null,
            render: (u) =>
              u.updatedAt ? (
                <span className="text-right">
                  <span className="block font-semibold">{formatDateTime(u.updatedAt)}</span>
                  <span className="block text-xs text-muted-foreground">{formatRelativeTime(u.updatedAt)}</span>
                </span>
              ) : undefined,
          },
        ],
      },

      // ---- Documentação (Admissão) — tabela própria --------------------------
      {
        id: "documentation",
        label: "Documentação",
        icon: IconCertificate2,
        span: 1,
        render: (u) => <UserDocumentationCard userId={u.id} embedded onCount={(n) => reportCount("documentation", n)} />,
      },

      // ---- Tamanhos de EPI ---------------------------------------------------
      {
        id: "ppe-sizes",
        label: "Tamanhos de EPI",
        icon: IconShirt,
        span: 1,
        fields: [
          { id: "ppeShirts", label: "Camisa", icon: IconShirt, dataType: "relation", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => (u.ppeSize?.shirts ? SHIRT_SIZE_LABELS[u.ppeSize.shirts] : null), edit: ppeEdit("shirts", SHIRT_SIZE_LABELS) },
          { id: "ppePants", label: "Calça", icon: IconHanger, dataType: "relation", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => (u.ppeSize?.pants ? PANTS_SIZE_LABELS[u.ppeSize.pants] : null), edit: ppeEdit("pants", PANTS_SIZE_LABELS) },
          { id: "ppeShorts", label: "Bermuda", icon: IconHanger, dataType: "relation", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => (u.ppeSize?.shorts ? PANTS_SIZE_LABELS[u.ppeSize.shorts] : null), edit: ppeEdit("shorts", PANTS_SIZE_LABELS) },
          { id: "ppeBoots", label: "Botas", icon: IconShoe, dataType: "relation", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => (u.ppeSize?.boots ? BOOT_SIZE_LABELS[u.ppeSize.boots] : null), edit: ppeEdit("boots", BOOT_SIZE_LABELS) },
          { id: "ppeRainBoots", label: "Galocha", icon: IconUmbrella, dataType: "relation", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => (u.ppeSize?.rainBoots ? RAIN_BOOTS_SIZE_LABELS[u.ppeSize.rainBoots] : null), edit: ppeEdit("rainBoots", RAIN_BOOTS_SIZE_LABELS) },
          { id: "ppeSleeves", label: "Manguito", icon: IconHanger, dataType: "relation", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => (u.ppeSize?.sleeves ? SLEEVES_SIZE_LABELS[u.ppeSize.sleeves] : null), edit: ppeEdit("sleeves", SLEEVES_SIZE_LABELS) },
          { id: "ppeMask", label: "Máscara", icon: IconMask, dataType: "relation", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => (u.ppeSize?.mask ? MASK_SIZE_LABELS[u.ppeSize.mask] : null), edit: ppeEdit("mask", MASK_SIZE_LABELS) },
          { id: "ppeGloves", label: "Luvas", icon: IconHandGrab, dataType: "relation", editablePrivilege: HR_ACC_ADMIN, accessor: (u) => (u.ppeSize?.gloves ? GLOVES_SIZE_LABELS[u.ppeSize.gloves] : null), edit: ppeEdit("gloves", GLOVES_SIZE_LABELS) },
        ],
      },

      // Vínculo + cargo (promotion) history are NOT separate sections — those changes are captured in
      // the changelog ("Histórico de Alterações") below.

      // ---- Benefícios / Dependentes (largos) ---------------------------------
      {
        id: "benefits",
        label: "Benefícios",
        icon: IconGift,
        span: 2,
        render: (u) => <UserBenefitsCard userId={u.id} embedded onCount={(n) => reportCount("benefits", n)} />,
      },
      {
        id: "dependents",
        label: "Dependentes",
        icon: IconUsers,
        span: 2,
        render: (u) => <DependentsCard userId={u.id} embedded onCount={(n) => reportCount("dependents", n)} />,
      },

      // ---- Folha: Empréstimos (CLT) + 13º ------------------------------------
      ...(isCltCollaborator
        ? [
            {
              id: "loans",
              label: "Empréstimos / Adiantamentos",
              icon: IconCreditCard,
              span: 2 as const,
              requiredPrivilege: HR_ACC_ADMIN,
              render: (u: User) => <CollaboratorLoansCard userId={u.id} embedded onCount={(n) => reportCount("loans", n)} />,
            },
          ]
        : []),
      {
        id: "thirteenth",
        label: "13º Salário",
        icon: IconCreditCard,
        span: 2,
        requiredPrivilege: HR_ACC_ADMIN,
        render: (u) => <CollaboratorThirteenthCard userId={u.id} userName={u.name} embedded onCount={(n) => reportCount("thirteenth", n)} />,
      },

      // ---- Auditoria: Atividades + Histórico de Alterações -------------------
      {
        id: "related-activities",
        label: "Histórico de Atividades",
        icon: IconClock,
        span: 2,
        scroll: true,
        // Activities are loaded inline on the user — gate directly (the card
        // self-hides on empty, but the base can't see a truthy element, so return
        // null here when there are none).
        render: (u) => ((u.activities?.length ?? 0) > 0 ? <RelatedActivitiesCard user={u} embedded maxHeight="100%" className="h-full" /> : null),
      },
      {
        id: "changelog",
        label: "Histórico de Alterações",
        icon: IconHistory,
        span: 2,
        scroll: true,
        render: (u) => <ChangelogHistory embedded entityType={CHANGE_LOG_ENTITY_TYPE.USER} entityId={u.id} className="w-full" />,
      },

      // No separate "Informações de Contato" section — the phone already lives in Informações Básicas.
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isCltCollaborator, user?.position, user?.sector]);

  // Drop a section once its embedded card has reported exactly 0 records. While
  // the count is undefined (not yet reported) or null (loading), the section
  // stays visible so the card can mount and report. Sections without a count
  // entry (Informações Básicas, Endereço, etc.) are always kept.
  const visibleSections = useMemo(() => sections.filter((s) => counts[s.id] !== 0), [sections, counts]);

  const actions = useMemo<PageAction[]>(() => {
    const list: PageAction[] = [];
    if (canEdit && id) {
      list.push({ key: "edit", label: "Editar", icon: IconEdit, variant: "default", onClick: () => navigate(routes.administration.collaborators.edit(id)) });
    }
    if (canDelete) {
      list.push({ key: "delete", label: "Excluir", icon: IconTrash, variant: "destructive", onClick: () => setIsDeleteDialogOpen(true) });
    }
    return list;
  }, [canEdit, canDelete, id, navigate]);

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await mutations.deleteAsync(id);
      navigate(routes.administration.collaborators.root);
    } catch {
      setIsDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!id) {
    return <Navigate to={routes.administration.collaborators.root} replace />;
  }

  const status = user ? (() => {
    const s = getCollaboratorStatus(user);
    return { label: s.label, variant: headerStatusVariant(s.variant), icon: IconShieldCheck };
  })() : undefined;

  return (
    <>
      <DetailPage<User>
        detailKey="collaborator-detail"
        data={user}
        isLoading={isLoading}
        error={error ? "Erro ao carregar colaborador" : undefined}
        sections={visibleSections}
        title={user?.name ?? "Colaborador"}
        icon={IconUser}
        breadcrumbs={breadcrumbs}
        status={status}
        actions={actions}
        hideEmptyFields
        navigation={{
          ids: (location.state as { ids?: string[] } | null)?.ids,
          toRoute: (rid) => routes.administration.collaborators.details(rid),
        }}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o colaborador "{user?.name}"? Esta ação não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> : <IconTrash className="mr-2 h-4 w-4" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default UserDetailPage;
