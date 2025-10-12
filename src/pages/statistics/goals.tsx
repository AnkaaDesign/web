/**
 * Goal Tracking Page
 *
 * Set, track, and monitor goals with progress indicators
 * and historical performance analysis.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { GoalProgressBar } from './analytics/components/GoalProgressBar';
import { IconPlus, IconRefresh, IconTrophy, IconTarget } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface Goal {
  id: string;
  title: string;
  current: number;
  target: number;
  unit?: string;
  format: 'number' | 'currency' | 'percentage';
  deadline: Date;
  status: 'on-track' | 'at-risk' | 'off-track' | 'completed';
  historicalData: Array<{ date: Date; value: number }>;
  owner?: string;
  category: string;
}

export default function GoalTrackingPage() {
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: '1',
      title: 'Monthly Revenue Target',
      current: 680000,
      target: 750000,
      format: 'currency',
      deadline: new Date(2025, 11, 31),
      status: 'on-track',
      owner: 'Sales Team',
      category: 'Financial',
      historicalData: generateHistoricalData(30, 500000, 680000)
    },
    {
      id: '2',
      title: 'Customer Satisfaction Score',
      current: 4.6,
      target: 4.8,
      format: 'number',
      unit: '/5.0',
      deadline: new Date(2025, 11, 31),
      status: 'on-track',
      owner: 'Customer Success',
      category: 'Customer',
      historicalData: generateHistoricalData(30, 4.2, 4.6)
    },
    {
      id: '3',
      title: 'Production Efficiency',
      current: 87,
      target: 95,
      format: 'percentage',
      deadline: new Date(2025, 11, 31),
      status: 'at-risk',
      owner: 'Operations',
      category: 'Operations',
      historicalData: generateHistoricalData(30, 80, 87)
    },
    {
      id: '4',
      title: 'New Customer Acquisition',
      current: 145,
      target: 200,
      format: 'number',
      unit: 'customers',
      deadline: new Date(2025, 11, 31),
      status: 'on-track',
      owner: 'Marketing',
      category: 'Growth',
      historicalData: generateHistoricalData(30, 100, 145)
    },
    {
      id: '5',
      title: 'Cost Reduction',
      current: 12,
      target: 15,
      format: 'percentage',
      deadline: new Date(2025, 11, 31),
      status: 'at-risk',
      owner: 'Finance',
      category: 'Financial',
      historicalData: generateHistoricalData(30, 8, 12)
    }
  ]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newGoalOpen, setNewGoalOpen] = useState(false);

  // Filter goals by category
  const filteredGoals = selectedCategory === 'all'
    ? goals
    : goals.filter(g => g.category === selectedCategory);

  // Calculate statistics
  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const onTrackGoals = goals.filter(g => g.status === 'on-track').length;
  const atRiskGoals = goals.filter(g => g.status === 'at-risk').length;
  const offTrackGoals = goals.filter(g => g.status === 'off-track').length;
  const achievementRate = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;

  // Get unique categories
  const categories = ['all', ...new Set(goals.map(g => g.category))];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Goal Tracking</h1>
          <p className="text-muted-foreground mt-1">
            Monitor progress towards your strategic objectives
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <IconRefresh className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={newGoalOpen} onOpenChange={setNewGoalOpen}>
            <DialogTrigger asChild>
              <Button>
                <IconPlus className="h-4 w-4 mr-2" />
                New Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Goal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="goal-title">Goal Title</Label>
                  <Input id="goal-title" placeholder="e.g., Increase Revenue by 20%" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="target">Target Value</Label>
                    <Input id="target" type="number" placeholder="100" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="format">Format</Label>
                    <Select defaultValue="number">
                      <SelectTrigger id="format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="currency">Currency</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input id="deadline" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select defaultValue="Financial">
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Financial">Financial</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Customer">Customer</SelectItem>
                      <SelectItem value="Growth">Growth</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner">Goal Owner</Label>
                  <Input id="owner" placeholder="Team or person responsible" />
                </div>
                <Button className="w-full">Create Goal</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGoals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">On Track</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{onTrackGoals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">At Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{atRiskGoals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Off Track</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{offTrackGoals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Achievement Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{achievementRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(category)}
                className="capitalize"
              >
                {category}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Goals List */}
      <div className="space-y-4">
        {filteredGoals.map((goal) => (
          <GoalProgressBar
            key={goal.id}
            title={goal.title}
            current={goal.current}
            target={goal.target}
            unit={goal.unit}
            format={goal.format}
            historicalData={goal.historicalData}
            deadline={goal.deadline}
            status={goal.status}
          />
        ))}
      </div>

      {/* Historical Performance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconTrophy className="h-5 w-5 text-yellow-600" />
            <CardTitle>Historical Performance</CardTitle>
          </div>
          <CardDescription>Past goals and achievement history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { title: 'Q3 Revenue Target', achieved: true, date: '2025-09-30', percentage: 105 },
              { title: 'Customer Acquisition Q3', achieved: true, date: '2025-09-30', percentage: 112 },
              { title: 'Cost Reduction Q3', achieved: false, date: '2025-09-30', percentage: 92 },
              { title: 'Q2 Revenue Target', achieved: true, date: '2025-06-30', percentage: 108 }
            ].map((item, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border',
                  item.achieved ? 'bg-green-50 dark:bg-green-950/20 border-green-200' : 'bg-red-50 dark:bg-red-950/20 border-red-200'
                )}
              >
                <div className="flex items-center gap-3">
                  {item.achieved ? (
                    <IconTrophy className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <IconTarget className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-muted-foreground">
                      Completed: {new Date(item.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    'text-lg font-bold',
                    item.achieved ? 'text-green-600' : 'text-red-600'
                  )}>
                    {item.percentage}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.achieved ? 'Achieved' : 'Missed'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to generate historical data
function generateHistoricalData(days: number, start: number, end: number): Array<{ date: Date; value: number }> {
  const data: Array<{ date: Date; value: number }> = [];
  const increment = (end - start) / days;

  for (let i = 0; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    const value = start + (increment * i) + (Math.random() - 0.5) * increment * 0.2;
    data.push({ date, value });
  }

  return data;
}
