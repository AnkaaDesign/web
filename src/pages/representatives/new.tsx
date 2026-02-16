import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RepresentativeForm } from '@/components/administration/customer/representative';
import { PageHeader } from '@/components/ui/page-header';
import { IconUsers, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { useCreateRepresentative } from '@/hooks/administration/use-representative';
import { routes } from '@/constants';
import type { RepresentativeCreateFormData } from '@/types/representative';

export default function NewRepresentativePage() {
  const navigate = useNavigate();
  const createRepresentative = useCreateRepresentative();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const handleSubmit = async (data: RepresentativeCreateFormData) => {
    try {
      const response = await createRepresentative.mutateAsync(data);
      const id = response?.id ?? (response as any)?.data?.id;

      if (id) {
        navigate(routes.representatives.details(id));
      } else {
        navigate(routes.representatives.root);
      }
    } catch (error: any) {
      // Error is already handled by the API client
    }
  };

  const handleCancel = () => {
    navigate(routes.representatives.root);
  };

  const actions = [
    {
      key: 'cancel',
      label: 'Cancelar',
      onClick: handleCancel,
      variant: 'outline' as const,
      disabled: createRepresentative.isPending,
    },
    {
      key: 'submit',
      label: 'Cadastrar',
      icon: createRepresentative.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById('representative-form-submit')?.click(),
      variant: 'default' as const,
      disabled: createRepresentative.isPending || !formState.isValid,
      loading: createRepresentative.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <div className="container mx-auto max-w-4xl flex-shrink-0">
        <PageHeader
          title="Cadastrar Representante"
          icon={IconUsers}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Administração', href: routes.administration.root },
            { label: 'Clientes', href: routes.administration.customers.root },
            { label: 'Representantes', href: routes.representatives.root },
            { label: 'Cadastrar' },
          ]}
          actions={actions}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <RepresentativeForm
          mode="create"
          onSubmit={handleSubmit}
          isSubmitting={createRepresentative.isPending}
          onFormStateChange={setFormState}
        />
      </div>
    </div>
  );
}
