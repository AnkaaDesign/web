import { useState, useEffect, useCallback, useRef } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { getBenefits } from "../../../../api-client/benefit";
import { userService } from "../../../../api-client";
import { BENEFIT_ENROLLMENT_STATUS_LABELS, BENEFIT_KIND_LABELS } from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { IconCategory, IconFilter, IconGift, IconProgressCheck, IconUser } from "@tabler/icons-react";
import type { UserBenefitGetManyFormData } from "../../../../schemas/benefit";

interface UserBenefitFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<UserBenefitGetManyFormData>;
  onFilterChange: (filters: Partial<UserBenefitGetManyFormData>) => void;
}

export function UserBenefitFilters({ open, onOpenChange, filters, onFilterChange }: UserBenefitFiltersProps) {
  // Cache refs for selected options in multiple mode
  const benefitCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const userCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Local state for immediate UI updates
  const [localFilters, setLocalFilters] = useState(filters);

  // Sync local state with URL filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Get current values for multi-select components
  const selectedStatuses = localFilters.statuses || [];
  const selectedBenefits = localFilters.benefitIds || [];
  const selectedUsers = localFilters.userIds || [];
  const selectedKinds = localFilters.kinds || [];

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  const handleStatusChange = (statuses: string[]) => {
    setLocalFilters({ ...localFilters, statuses: statuses.length > 0 ? statuses : undefined });
  };

  const handleBenefitChange = (benefitIds: string[]) => {
    setLocalFilters({ ...localFilters, benefitIds: benefitIds.length > 0 ? benefitIds : undefined });
  };

  const handleUserChange = (userIds: string[]) => {
    setLocalFilters({ ...localFilters, userIds: userIds.length > 0 ? userIds : undefined });
  };

  const handleKindChange = (kinds: string[]) => {
    setLocalFilters({ ...localFilters, kinds: kinds.length > 0 ? kinds : undefined });
  };

  // Status options (static, no async needed)
  const statusOptions = Object.entries(BENEFIT_ENROLLMENT_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  // Benefit kind options (static, no async needed)
  const kindOptions = Object.entries(BENEFIT_KIND_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  // Async query function for benefits
  const queryBenefits = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getBenefits(queryParams);
      const benefits = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = benefits.map((benefit) => {
        const option = {
          value: benefit.id,
          label: benefit.name,
        };
        // Add to cache for multiple mode
        benefitCacheRef.current.set(benefit.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error fetching benefits:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Async query function for users
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        isActive: true, // enrollments only apply to active collaborators
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await userService.getUsers(queryParams);
      const users = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = users.map((user: { id: string; name: string }) => {
        const option = {
          value: user.id,
          label: user.name,
        };
        // Add to cache for multiple mode
        userCacheRef.current.set(user.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error fetching users:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Count active filters
  const activeFilterCount = Object.entries(localFilters).filter(([key, value]) => {
    if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== "";
  }).length;

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros Avançados"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre as adesões por benefício, tipo, status e colaborador"
      activeFilterCount={activeFilterCount}
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconGift className="h-4 w-4" />
          Benefício
        </Label>
        <Combobox
          async={true}
          mode="multiple"
          queryKey={["benefits", "filter"]}
          queryFn={queryBenefits}
          initialOptions={[]}
          value={selectedBenefits}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handleBenefitChange(arr);
          }}
          placeholder="Selecione os benefícios"
          searchable={true}
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconCategory className="h-4 w-4" />
          Tipo de Benefício
        </Label>
        <Combobox
          mode="multiple"
          options={kindOptions}
          value={selectedKinds}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handleKindChange(arr);
          }}
          placeholder="Selecione os tipos"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconProgressCheck className="h-4 w-4" />
          Status
        </Label>
        <Combobox
          mode="multiple"
          options={statusOptions}
          value={selectedStatuses}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handleStatusChange(arr);
          }}
          placeholder="Selecione os status"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconUser className="h-4 w-4" />
          Colaborador
        </Label>
        <Combobox
          async={true}
          mode="multiple"
          queryKey={["users", "user-benefit-filter"]}
          queryFn={queryUsers}
          initialOptions={[]}
          value={selectedUsers}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handleUserChange(arr);
          }}
          placeholder="Selecione os colaboradores"
          searchable={true}
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
        />
      </div>
    </FilterDrawer>
  );
}
