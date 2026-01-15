import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconFileInvoice, IconCheck, IconAlertCircle, IconLoader2 } from "@tabler/icons-react";
import { taskPricingService } from "@/api-client/task-pricing";
import { toast } from "sonner";

export default function CreateTestPricingPage() {
  const [taskId, setTaskId] = useState("82d32ee1-6981-4240-996e-255d38faedcb");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

  const handleCreatePricing = async () => {
    if (!taskId.trim()) {
      toast.error("Por favor, informe o ID da tarefa");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Calculate expiry date (30 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      expiryDate.setHours(23, 59, 59, 999);

      const pricingData = {
        taskId: taskId.trim(),
        subtotal: 15500.00,
        discountType: 'PERCENTAGE',
        discountValue: 10.00,
        total: 13950.00,
        status: 'APPROVED',
        expiresAt: expiryDate.toISOString(),
        items: [
          {
            description: 'Adesivação Completa do Caminhão - Laterais e Traseira',
            amount: 8500.00
          },
          {
            description: 'Aplicação de Logotipo em Vinil de Alta Qualidade',
            amount: 2500.00
          },
          {
            description: 'Envelopamento Completo de Para-choque Dianteiro',
            amount: 1800.00
          },
          {
            description: 'Recorte em Plotter e Plotagem de Arte',
            amount: 1200.00
          },
          {
            description: 'Aplicação de Película de Proteção UV',
            amount: 1500.00
          }
        ]
      };

      const response = await taskPricingService.create(pricingData);

      setResult({
        success: true,
        message: "Precificação criada com sucesso!",
        data: response.data
      });

      toast.success("Precificação de teste criada com sucesso!");
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Erro ao criar precificação";

      setResult({
        success: false,
        message: errorMessage,
        data: error.response?.data
      });

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Criar Precificação de Teste</h1>
        <p className="text-muted-foreground">
          Utilitário para criar dados de precificação de teste para validação do export de PDF
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconFileInvoice className="h-5 w-5" />
            Dados da Precificação
          </CardTitle>
          <CardDescription>
            Esta precificação será criada com 5 itens, desconto de 10% e status APROVADO
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Task ID Input */}
          <div className="space-y-2">
            <Label htmlFor="taskId">ID da Tarefa</Label>
            <Input
              id="taskId"
              type="text"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              placeholder="UUID da tarefa"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Informe o ID da tarefa onde a precificação será criada
            </p>
          </div>

          {/* Pricing Details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm mb-3">Detalhes da Precificação:</h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Itens:</span>
                <span className="ml-2 font-medium">5 serviços</span>
              </div>
              <div>
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="ml-2 font-medium">R$ 15.500,00</span>
              </div>
              <div>
                <span className="text-muted-foreground">Desconto:</span>
                <span className="ml-2 font-medium">10% (R$ 1.550,00)</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total:</span>
                <span className="ml-2 font-medium text-primary">R$ 13.950,00</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2 font-medium">APPROVED</span>
              </div>
              <div>
                <span className="text-muted-foreground">Validade:</span>
                <span className="ml-2 font-medium">30 dias</span>
              </div>
            </div>

            <div className="pt-3 border-t mt-3">
              <p className="text-xs font-semibold mb-2">Serviços:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Adesivação Completa do Caminhão (R$ 8.500,00)</li>
                <li>• Aplicação de Logotipo em Vinil (R$ 2.500,00)</li>
                <li>• Envelopamento de Para-choque (R$ 1.800,00)</li>
                <li>• Recorte em Plotter e Plotagem (R$ 1.200,00)</li>
                <li>• Aplicação de Película UV (R$ 1.500,00)</li>
              </ul>
            </div>
          </div>

          {/* Create Button */}
          <Button
            onClick={handleCreatePricing}
            disabled={loading || !taskId.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando Precificação...
              </>
            ) : (
              <>
                <IconFileInvoice className="h-4 w-4 mr-2" />
                Criar Precificação de Teste
              </>
            )}
          </Button>

          {/* Result Alert */}
          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <IconCheck className="h-4 w-4" />
              ) : (
                <IconAlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                <p className="font-medium mb-2">{result.message}</p>

                {result.success && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm">✅ Próximos passos:</p>
                    <ol className="text-sm list-decimal list-inside space-y-1 ml-2">
                      <li>Acesse a página de edição da tarefa</li>
                      <li>Role até a seção "Precificação Detalhada"</li>
                      <li>Clique no botão "Exportar PDF"</li>
                      <li>Teste o export do orçamento!</li>
                    </ol>
                  </div>
                )}

                {result.data && (
                  <details className="mt-3">
                    <summary className="text-xs cursor-pointer hover:underline">
                      Ver resposta da API
                    </summary>
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-60">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">ℹ️ Informações</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Esta página cria dados de precificação de teste para validar a funcionalidade de export de PDF de orçamentos.
          </p>
          <p>
            <strong>Nota:</strong> Se a tarefa já possuir precificação, será necessário removê-la manualmente no banco de dados antes de criar uma nova.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
