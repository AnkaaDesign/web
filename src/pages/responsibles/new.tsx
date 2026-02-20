import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsibleForm } from '@/components/administration/customer/responsible';
import { PageHeader } from '@/components/ui/page-header';
import { IconUsers, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { useCreateResponsible } from '@/hooks/administration/use-responsible';
import { routes } from '@/constants';
import type { ResponsibleCreateFormData } from '@/types/responsible';

export default function NewResponsiblePage() {
  const navigate = useNavigate();
  const createResponsible = useCreateResponsible();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const handleSubmit = async (data: ResponsibleCreateFormData) => {
    try {
      const response = await createResponsible.mutateAsync(data);
      const id = response?.id ?? (response as any)?.data?.id;

      if (id) {
        navigate(routes.responsibles.details(id));
      } else {
        navigate(routes.responsibles.root);
      }
    } catch (error: any) {
      // Error is already handled by the API client
    }
  };

  const handleCancel = () => {
    navigate(routes.responsibles.root);
  };

  const actions = [
    {
      key: 'cancel',
      label: 'Cancelar',
      onClick: handleCancel,
      variant: 'outline' as const,
      disabled: createResponsible.isPending,
    },
    {
      key: 'submit',
      label: 'Cadastrar',
      icon: createResponsible.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById('responsible-form-submit')?.click(),
      variant: 'default' as const,
      disabled: createResponsible.isPending || !formState.isValid,
      loading: createResponsible.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <div className="container mx-auto max-w-4xl flex-shrink-0">
        <PageHeader
          title="Cadastrar Responsável"
          icon={IconUsers}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Administração', href: routes.administration.root },
            { label: 'Clientes', href: routes.administration.customers.root },
            { label: 'Responsáveis', href: routes.responsibles.root },
            { label: 'Cadastrar' },
          ]}
          actions={actions}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <ResponsibleForm
          mode="create"
          onSubmit={handleSubmit}
          isSubmitting={createResponsible.isPending}
          onFormStateChange={setFormState}
        />
      </div>
    </div>
  );
}
