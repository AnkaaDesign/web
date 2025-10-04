import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, TrendingDown, Minus, Medal } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserActivityData {
  userId: string;
  name: string;
  avatar?: string;
  totalActivities: number;
  productionActivities: number;
  maintenanceActivities: number;
  epiDeliveries: number;
  borrowReturns: number;
  accuracy: number;
  trend: "up" | "down" | "stable";
  trendValue: number;
  department: string;
}

export function UserActivityRanking() {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("month");

  // Generate mock user activity data
  const generateUserData = (): UserActivityData[] => {
    const names = [
      "João Silva",
      "Maria Santos",
      "Pedro Oliveira",
      "Ana Costa",
      "Carlos Ferreira",
      "Lucia Almeida",
      "Roberto Lima",
      "Patricia Souza",
      "Fernando Martins",
      "Beatriz Rocha",
    ];

    const departments = ["Produção", "Manutenção", "Logística", "Almoxarifado"];

    return names.map((name, index) => {
      const total = Math.floor(Math.random() * 500) + 100;
      const trend = Math.random();

      return {
        userId: `user-${index + 1}`,
        name,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        totalActivities: total,
        productionActivities: Math.floor(total * 0.4),
        maintenanceActivities: Math.floor(total * 0.2),
        epiDeliveries: Math.floor(total * 0.15),
        borrowReturns: Math.floor(total * 0.25),
        accuracy: 85 + Math.floor(Math.random() * 15),
        trend: trend > 0.66 ? "up" : trend > 0.33 ? "stable" : "down",
        trendValue: Math.floor(Math.random() * 30) - 15,
        department: departments[Math.floor(Math.random() * departments.length)],
      };
    }).sort((a, b) => b.totalActivities - a.totalActivities);
  };

  const userData = generateUserData();
  const topUsers = userData.slice(0, 5);

  // Prepare data for stacked bar chart
  const chartData = topUsers.map(user => ({
    name: user.name.split(" ")[0], // First name only for chart
    Produção: user.productionActivities,
    Manutenção: user.maintenanceActivities,
    EPIs: user.epiDeliveries,
    Empréstimos: user.borrowReturns,
    total: user.totalActivities,
  }));

  // Colors for ranking positions
  const getRankColor = (position: number) => {
    switch (position) {
      case 0: return "#FFD700"; // Gold
      case 1: return "#C0C0C0"; // Silver
      case 2: return "#CD7F32"; // Bronze
      default: return "#6B7280"; // Gray
    }
  };

  const getTrendIcon = (trend: string, value: number) => {
    if (trend === "up") {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (trend === "down") {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <CardTitle>Ranking de Atividade por Usuário</CardTitle>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
            <TabsList>
              <TabsTrigger value="day">Hoje</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="year">Ano</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Users List */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Top 10 Usuários Mais Ativos
            </h3>
            {userData.map((user, index) => (
              <div
                key={user.userId}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  index < 3 ? "border-primary/20 bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank Medal */}
                  <div className="relative">
                    {index < 3 && (
                      <Medal
                        className="h-6 w-6"
                        style={{ color: getRankColor(index) }}
                      />
                    )}
                    {index >= 3 && (
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                    )}
                  </div>

                  {/* User Info */}
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.department} • {user.accuracy}% precisão
                    </div>
                  </div>
                </div>

                {/* Activity Count and Trend */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-semibold">{user.totalActivities}</div>
                    <div className="flex items-center gap-1 text-xs">
                      {getTrendIcon(user.trend, user.trendValue)}
                      <span
                        className={
                          user.trend === "up"
                            ? "text-green-500"
                            : user.trend === "down"
                            ? "text-red-500"
                            : "text-gray-500"
                        }
                      >
                        {user.trendValue > 0 ? "+" : ""}{user.trendValue}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stacked Bar Chart */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Distribuição de Atividades - Top 5
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => value.toLocaleString("pt-BR")}
                  labelFormatter={(label) => `Usuário: ${label}`}
                />
                <Legend />
                <Bar dataKey="Produção" stackId="a" fill="#3B82F6" />
                <Bar dataKey="Manutenção" stackId="a" fill="#10B981" />
                <Bar dataKey="EPIs" stackId="a" fill="#F59E0B" />
                <Bar dataKey="Empréstimos" stackId="a" fill="#8B5CF6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Comparison */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Comparação por Departamento
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["Produção", "Manutenção", "Logística", "Almoxarifado"].map(dept => {
              const deptUsers = userData.filter(u => u.department === dept);
              const totalActivities = deptUsers.reduce((sum, u) => sum + u.totalActivities, 0);
              const avgAccuracy = deptUsers.length > 0
                ? Math.round(deptUsers.reduce((sum, u) => sum + u.accuracy, 0) / deptUsers.length)
                : 0;

              return (
                <div key={dept} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-sm font-medium text-muted-foreground">{dept}</div>
                  <div className="mt-2">
                    <div className="text-2xl font-bold">{totalActivities}</div>
                    <div className="text-xs text-muted-foreground">
                      {deptUsers.length} usuários • {avgAccuracy}% precisão
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Performance Badges */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Trophy className="h-3 w-3" />
            Campeão do Mês: {userData[0].name}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Maior Crescimento: Ana Costa (+28%)
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Medal className="h-3 w-3" />
            Melhor Precisão: Carlos Ferreira (99%)
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}