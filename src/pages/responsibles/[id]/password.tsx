import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/page-header';
import { IconLock, IconEye, IconEyeOff, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { responsibleService } from '@/services/responsibleService';
import { useToast } from '@/hooks/common/use-toast';
import { LoadingSpinner } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { routes } from '@/constants';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// Password update schema
const passwordSchema = z.object({
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirmação deve ter no mínimo 6 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function UpdatePasswordPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Fetch responsible data
  const { data: responsible, isLoading, error } = useQuery({
    queryKey: ['responsible', id],
    queryFn: () => responsibleService.getById(id!),
    enabled: !!id,
  });

  // Form
  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: (password: string) =>
      responsibleService.updatePassword(id!, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responsible', id] });
      toast({
        title: 'Sucesso',
        description: 'Senha atualizada com sucesso',
      });
      navigate(routes.responsibles.root);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar senha',
        variant: 'error',
      });
    },
  });

  const onSubmit = (data: PasswordFormData) => {
    updatePasswordMutation.mutate(data.password);
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
      disabled: updatePasswordMutation.isPending,
    },
    {
      key: 'submit',
      label: 'Salvar',
      icon: updatePasswordMutation.isPending ? IconLoader2 : IconCheck,
      onClick: form.handleSubmit(onSubmit),
      variant: 'default' as const,
      disabled: updatePasswordMutation.isPending || !form.formState.isValid,
      loading: updatePasswordMutation.isPending,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !responsible) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>
            {error?.message || 'Responsável não encontrado'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <div className="container mx-auto max-w-2xl flex-shrink-0">
        <PageHeader
          title="Alterar Senha"
          icon={IconLock}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Administração', href: routes.administration.root },
            { label: 'Clientes', href: routes.administration.customers.root },
            { label: 'Responsáveis', href: routes.responsibles.root },
            { label: responsible.name, href: routes.responsibles.edit(id!) },
            { label: 'Alterar Senha' },
          ]}
          actions={actions}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="container mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Definir Nova Senha</CardTitle>
              <CardDescription>
                Atualize a senha de acesso para {responsible.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nova Senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Digite a nova senha"
                              disabled={updatePasswordMutation.isPending}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <IconEyeOff className="h-4 w-4" />
                              ) : (
                                <IconEye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar Nova Senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirme a nova senha"
                              disabled={updatePasswordMutation.isPending}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? (
                                <IconEyeOff className="h-4 w-4" />
                              ) : (
                                <IconEye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
