import { useState } from "react";
import { Expense } from "../../../types";
import { ExpenseCard } from "./expense-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ExpenseListProps {
  expenses: Expense[];
  isLoading?: boolean;
  onCreateNew?: () => void;
  onExpenseClick?: (expense: Expense) => void;
}

export function ExpenseList({
  expenses,
  isLoading = false,
  onCreateNew,
  onExpenseClick,
}: ExpenseListProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredExpenses = expenses.filter((expense) =>
    expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Despesas</h1>
          <p className="text-muted-foreground">
            Gerencie as despesas da empresa
          </p>
        </div>

        {onCreateNew && (
          <Button onClick={onCreateNew}>
            <IconPlus className="h-4 w-4 mr-2" />
            Nova Despesa
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar por descrição, fornecedor ou número do recibo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredExpenses.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {filteredExpenses.filter(e => e.status === 'PENDING').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense List */}
      {filteredExpenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <IconSearch className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold">Nenhuma despesa encontrada</h3>
              <p className="text-muted-foreground max-w-sm">
                {searchTerm
                  ? "Tente ajustar os termos de busca ou limpar os filtros."
                  : "Não há despesas cadastradas ainda."}
              </p>
              {onCreateNew && !searchTerm && (
                <Button onClick={onCreateNew} className="mt-4">
                  <IconPlus className="h-4 w-4 mr-2" />
                  Criar primeira despesa
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExpenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onClick={() => onExpenseClick?.(expense)}
            />
          ))}
        </div>
      )}
    </div>
  );
}