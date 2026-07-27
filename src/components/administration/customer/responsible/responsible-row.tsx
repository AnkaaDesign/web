import { useCallback, useMemo, useState, forwardRef } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BasePhoneInput } from '@/components/ui/phone-input';
import { Combobox } from '@/components/ui/combobox';
import { FormLabel } from '@/components/ui/form';
import { CustomerCombobox } from '@/components/ui/customer-combobox';
import { cn } from '@/lib/utils';
import { responsibleService } from '@/services/responsibleService';
import { toBrazilianNameCase } from '@/utils/formatters';
import { isValidCPF } from '@/utils/validators';
import type { Responsible, ResponsibleRole, ResponsibleRowData } from '@/types/responsible';
import { RESPONSIBLE_ROLE_LABELS, getResponsibleRoles } from '@/types/responsible';

interface ResponsibleRowProps {
  control?: any;
  index: number;
  companyId: string;
  disabled?: boolean;
  readOnly?: boolean;
  onRemove: () => void;
  isFirstRow: boolean;
  isLastRow: boolean;
  value: ResponsibleRowData;
  onChange: (updates: Partial<ResponsibleRowData>) => void;
  showErrors?: boolean;
}

const CREATE_NEW_VALUE = '__CREATE_NEW__';

// Module-level shared cache so all ResponsibleRow instances can look up responsibles
// regardless of which instance's queryFn was called by React Query (query deduplication)
const responsibleCache = new Map<string, Responsible>();

export const ResponsibleRow = forwardRef<HTMLDivElement, ResponsibleRowProps>(
  ({
    companyId: _companyId,
    disabled,
    readOnly,
    onRemove,
    isFirstRow,
    value,
    onChange,
    showErrors = false,
  }, ref) => {
    // Determine if we're in create mode based on the value
    const showCreateInputs = value.isEditing && value.id?.startsWith('temp-');

    // Track which fields have been touched (blurred) for inline validation
    const [touched, setTouched] = useState<{ name?: boolean; phone?: boolean; cpf?: boolean; email?: boolean }>({});

    // Validation: name and phone are required when in create mode
    const nameEmpty = showCreateInputs && !value.name?.trim();
    const phoneEmpty = showCreateInputs && !value.phone?.trim();
    const nameError = nameEmpty && (touched.name || showErrors);
    const phoneError = phoneEmpty && (touched.phone || showErrors);

    // CPF e e-mail são OPCIONAIS — só erram quando preenchidos e inválidos.
    // O CPF vai para o mesmo campo que a cerimônia de assinatura consulta, e o
    // servidor recusa mod-11 inválido com uma mensagem genérica; conferir aqui
    // é o que dá ao usuário um erro no campo certo.
    const cpfDigits = (value.cpf || '').replace(/\D/g, '');
    const cpfInvalid = showCreateInputs && cpfDigits.length > 0 && !isValidCPF(cpfDigits);
    const cpfError = cpfInvalid && (touched.cpf || showErrors);
    const emailInvalid =
      showCreateInputs && !!value.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim());
    const emailError = emailInvalid && (touched.email || showErrors);

    // Async query function for the Combobox
    const queryFn = useCallback(async (searchTerm: string, page?: number) => {
      const response = await responsibleService.getAll({
        search: searchTerm || undefined,
        isActive: true,
        page: page || 1,
        pageSize: 20,
      });
      // Cache fetched reps in shared module-level cache
      response.data.forEach(rep => responsibleCache.set(rep.id, rep));
      return {
        data: response.data,
        hasMore: response.meta.page < response.meta.pageCount,
      };
    }, []);

    // Query key changes when role changes, triggering a re-fetch
    const queryKey = useMemo(() => ['responsibles', 'combobox'], []);

    // Provide the currently selected rep as initial option so the Combobox can display it
    const initialOptions = useMemo(() => {
      if (value.id && !value.id.startsWith('temp-') && value.name) {
        const rep = { id: value.id, name: value.name, phone: value.phone || '', email: value.email || '', cpf: value.cpf ?? null, roles: value.roles ?? [], isActive: true } as Responsible;
        responsibleCache.set(rep.id, rep);
        return [rep];
      }
      return [];
    }, [value.id, value.name, value.phone, value.email, value.cpf, value.roles]);

    // Handle role selection — a contact can hold several roles at once.
    //
    // Only the roles change here. This used to blank id/name/phone and flag the
    // row as new, which was survivable while the selector existed solely in
    // create mode; now that selection mode shows it too, editing the role of an
    // already-chosen contact would have thrown that contact away.
    const handleRoleChange = useCallback((role: string | string[] | null | undefined) => {
      if (!role) return;
      const roles = (Array.isArray(role) ? role : [role]) as ResponsibleRole[];
      onChange({ ...value, roles });
    }, [onChange, value]);

    // Handle responsible selection
    const handleResponsibleChange = useCallback((selectedValue: string | string[] | null | undefined, searchTerm?: string) => {
      // Handle array values (shouldn't happen in single mode, but handle defensively)
      if (Array.isArray(selectedValue)) return;

      // Handle null/undefined - allow clearing the selection
      if (!selectedValue) {
        onChange({
          ...value,
          id: '',
          name: '',
          phone: '',
          email: '',
          cpf: null,
          isNew: false,
          isEditing: false,
        });
        return;
      }

      if (selectedValue === CREATE_NEW_VALUE) {
        onChange({
          ...value, // Preserve existing values, especially role
          id: `temp-${Date.now()}`,
          name: toBrazilianNameCase(searchTerm || ''),
          phone: '',
          email: '',
          cpf: null,
          isNew: true,
          isEditing: true, // This will trigger showCreateInputs
        });
      } else {
        // Select existing responsible from cache
        const rep = responsibleCache.get(selectedValue);
        if (rep) {
          onChange({
            id: rep.id,
            name: rep.name,
            phone: rep.phone,
            email: rep.email || '',
            cpf: rep.cpf ?? null,
            // Adopt the contact's registered roles. The row now shows a role
            // editor next to the combobox, so leaving the previous row's roles
            // in place would display something the contact does not actually
            // hold; the user can still edit them afterwards.
            roles: getResponsibleRoles(rep),
            // Retrato do que veio do cadastro — é contra ele que
            // `syncResponsibleRoles` decide se houve edição.
            originalRoles: getResponsibleRoles(rep),
            isActive: rep.isActive,
            isNew: false,
            isEditing: false,
          });
        }
      }
    }, [onChange, value]);

    // Handle customer selection from CustomerCombobox
    const handleCustomerChange = useCallback((customerId: string | null) => {
      onChange({ ...value, companyId: customerId });
    }, [onChange, value]);

    // Build role options
    const roleOptions = Object.entries(RESPONSIBLE_ROLE_LABELS).map(([key, label]) => ({
      value: key,
      label,
    }));

    // Format phone for display
    const formatPhoneDisplay = (phone: string) => {
      const numbers = phone.replace(/\D/g, "");
      if (numbers.length === 0) return phone;
      if (numbers.length === 11) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
      }
      if (numbers.length === 10) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
      }
      return phone; // Return as-is if not standard format
    };

    // Option accessors for Responsible type
    const getOptionValue = useCallback((rep: Responsible) => rep.id, []);
    const getOptionLabel = useCallback((rep: Responsible) => `${rep.name} - ${formatPhoneDisplay(rep.phone)}`, []);
    const getOptionDescription = useCallback((rep: Responsible) => rep.email || undefined, []);

    // Fixed top content for "Cadastrar novo" button (pinned between search and scrollable list)
    const fixedTopContent = useCallback((searchTerm: string) => (
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground border-b dark:border-border/30"
        onClick={() => handleResponsibleChange(CREATE_NEW_VALUE, searchTerm)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleResponsibleChange(CREATE_NEW_VALUE, searchTerm);
          }
        }}
      >
        <span className="truncate font-medium">+ Cadastrar novo{searchTerm ? ` "${toBrazilianNameCase(searchTerm)}"` : ''}</span>
      </div>
    ), [handleResponsibleChange]);

    // Determine the current responsible value
    const currentResponsibleValue = value.id && !value.id.startsWith('temp-') ? value.id : '';

    return (
      <div ref={ref} className={cn("space-y-3", (nameError || phoneError || cpfError || emailError) && "pb-4")}>
        {/* items-start, not items-end: the multi-role Combobox grows taller as
            chips wrap, and bottom alignment pushed every sibling input down with
            it. Each cell carries its own label, so the tops line up. */}
        <div className={cn(
          "grid grid-cols-1 gap-2 items-start",
          // Nome primeiro: a linha se identifica por QUEM e, nao pela funcao.
          // Cadastro inline tem 6 campos: em telas medias eles quebram em duas
          // colunas em vez de espremer tudo numa faixa ilegivel.
          showCreateInputs
            ? "sm:grid-cols-2 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)_minmax(0,3fr)_auto]"
            : "sm:grid-cols-[3fr_2fr_auto]"
        )}>
          {showCreateInputs ? (
            /* Cadastro inline: Nome + Telefone + CPF + E-mail + Função + Empresa + Remover */
            <>
              {/* Name */}
              <div className="relative space-y-2">
                {isFirstRow && <FormLabel>Nome <span className="text-destructive">*</span></FormLabel>}
                <Input
                  type="text"
                  value={value.name || ''}
                  onChange={(newValue) => {
                    const finalValue = typeof newValue === 'string' ? newValue : '';
                    onChange({
                      ...value,
                      name: finalValue,
                    });
                  }}
                  onBlur={() => {
                    setTouched(prev => ({ ...prev, name: true }));
                    if (value.name) {
                      onChange({
                        ...value,
                        name: toBrazilianNameCase(value.name),
                      });
                    }
                  }}
                  placeholder="Digite o nome"
                  disabled={disabled || readOnly}
                  className={cn("bg-transparent", nameError && "border-destructive")}
                  autoFocus
                />
                {nameError && <p className="absolute left-0 top-full mt-0.5 text-xs text-destructive whitespace-nowrap">Nome é obrigatório</p>}
              </div>

              {/* Phone */}
              <div className="relative space-y-2">
                {isFirstRow && <FormLabel>Telefone <span className="text-destructive">*</span></FormLabel>}
                <BasePhoneInput
                  value={value.phone || ''}
                  onChange={(phoneValue) => {
                    onChange({
                      ...value,
                      phone: phoneValue || '',
                    });
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                  placeholder="(00) 00000-0000"
                  disabled={disabled || readOnly}
                  className={cn("bg-transparent", phoneError && "border-destructive")}
                />
                {phoneError && <p className="absolute left-0 top-full mt-0.5 text-xs text-destructive whitespace-nowrap">Telefone é obrigatório</p>}
              </div>

              {/* CPF — opcional, mas é o que permite a conferência PARCIAL do
                  documento na assinatura eletrônica: com CPF cadastrado o
                  signatário completa só os dígitos ocultos, e acertar vale como
                  conferência de identidade. Sem ele, o primeiro a assinar digita
                  o número inteiro e é esse valor que fica gravado. */}
              <div className="relative space-y-2">
                {isFirstRow && <FormLabel>CPF</FormLabel>}
                <Input
                  type="cpf"
                  value={value.cpf ?? ''}
                  onChange={(newValue) => {
                    onChange({
                      ...value,
                      // O Input `type="cpf"` mascara na tela e devolve os dígitos limpos.
                      cpf: typeof newValue === 'string' && newValue !== '' ? newValue : null,
                    });
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, cpf: true }))}
                  placeholder="000.000.000-00"
                  disabled={disabled || readOnly}
                  className={cn("bg-transparent", cpfError && "border-destructive")}
                  transparent
                />
                {cpfError && <p className="absolute left-0 top-full mt-0.5 text-xs text-destructive whitespace-nowrap">CPF inválido</p>}
              </div>

              {/* E-mail — já existia em `ResponsibleRowData` e já era enviado no
                  payload, mas não tinha campo: era impossível preencher pela
                  linha. */}
              <div className="relative space-y-2">
                {isFirstRow && <FormLabel>E-mail</FormLabel>}
                <Input
                  type="email"
                  value={value.email || ''}
                  onChange={(newValue) => {
                    onChange({
                      ...value,
                      email: typeof newValue === 'string' ? newValue : '',
                    });
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                  placeholder="email@exemplo.com"
                  disabled={disabled || readOnly}
                  className={cn("bg-transparent", emailError && "border-destructive")}
                />
                {emailError && <p className="absolute left-0 top-full mt-0.5 text-xs text-destructive whitespace-nowrap">E-mail inválido</p>}
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                {isFirstRow && <FormLabel>Função</FormLabel>}
                <Combobox
                  mode="multiple"
                  value={value.roles ?? []}
                  onValueChange={handleRoleChange}
                  options={roleOptions}
                  placeholder="Selecione as funções"
                  emptyText="Nenhuma função encontrada"
                  disabled={disabled || readOnly}
                  searchable={false}
                />
              </div>

              {/* Company */}
              <div className="space-y-2">
                {isFirstRow && <FormLabel>Empresa</FormLabel>}
                <CustomerCombobox
                  value={value.companyId || null}
                  onValueChange={handleCustomerChange}
                  disabled={disabled || readOnly}
                  placeholder="Selecione a empresa"
                />
              </div>
            </>
          ) : (
            /* Selecao: Responsavel + Funcao */
            <>
              <div className="space-y-2">
              {isFirstRow && <FormLabel>Responsável</FormLabel>}
              <Combobox<Responsible>
                value={currentResponsibleValue || ''}
                onValueChange={(newValue) => {
                  // Prevent deselection when clicking the same value
                  if (newValue !== undefined) {
                    handleResponsibleChange(newValue);
                  }
                }}
                async
                queryKey={queryKey}
                queryFn={queryFn}
                initialOptions={initialOptions}
                minSearchLength={0}
                getOptionValue={getOptionValue}
                getOptionLabel={getOptionLabel}
                getOptionDescription={getOptionDescription}
                placeholder="Selecione ou cadastre novo"
                emptyText="Nenhum responsável encontrado"
                disabled={disabled || readOnly}
                searchable={true}
                fixedTopContent={fixedTopContent}
              />
              </div>

              {/* Role editor — mirrors the detail page, which shows each contact
                  as "Responsável <funções>". Without it the row could only pick
                  a contact and never see or correct the roles being recorded. */}
              <div className="space-y-2">
                {isFirstRow && <FormLabel>Função</FormLabel>}
                <Combobox
                  mode="multiple"
                  value={value.roles ?? []}
                  onValueChange={handleRoleChange}
                  options={roleOptions}
                  placeholder="Selecione as funções"
                  emptyText="Nenhuma função encontrada"
                  disabled={disabled || readOnly}
                  searchable={false}
                />
              </div>
            </>
          )}

          {/* Remove Button. The invisible label keeps the button level with the
              inputs on the first row, now that the grid aligns to the top. */}
          <div className="space-y-2">
            {isFirstRow && <FormLabel className="invisible block">Remover</FormLabel>}
            {!readOnly && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                disabled={disabled}
                className="text-destructive h-10 w-10"
                title="Remover responsável"
              >
                <IconTrash className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

ResponsibleRow.displayName = 'ResponsibleRow';
