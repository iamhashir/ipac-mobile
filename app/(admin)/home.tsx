import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/api/supabase';
import { ShoppingCart, Users, TrendingUp, Clock, Calendar } from 'lucide-react-native';
import { ChartContainer, OrdersBarChart } from '../../components/ui/chart';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<any>;
  color: string;
  subtitle?: string;
  loading?: boolean;
}

function StatCard({ title, value, icon: Icon, color, subtitle, loading }: StatCardProps) {
  return (
    <View className="bg-white rounded-lg shadow-sm p-4 flex-1 mx-1">
      <View className="flex-row items-center justify-between mb-2">
        <View className={`p-2 rounded-lg ${color}`}>
          <Icon size={20} color="white" />
        </View>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color="#6b7280" />
      ) : (
        <Text className="text-2xl font-bold text-gray-900">{value}</Text>
      )}
      <Text className="text-sm text-gray-600">{title}</Text>
      {subtitle && (
        <Text className="text-xs text-gray-500 mt-1">{subtitle}</Text>
      )}
    </View>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  onPress: () => void;
}

function QuickAction({ title, description, icon: Icon, color, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity 
      onPress={onPress}
      className="bg-white rounded-lg shadow-sm p-4 flex-row items-center mb-3"
    >
      <View className={`p-3 rounded-lg ${color} mr-4`}>
        <Icon size={24} color="white" />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-gray-900">{title}</Text>
        <Text className="text-sm text-gray-600">{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

type TimePeriod = '7days' | '1month' | '1year' | 'all';

interface ChartData {
  labels: string[];
  datasets: Array<{
    data: number[];
  }>;
}

const generateChartData = async (period: TimePeriod): Promise<ChartData> => {
  try {
    let startDate: Date;
    let labels: string[] = [];
    const now = new Date();
    
    switch (period) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        break;
      case '1month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        labels = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];
        break;
      case '1year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        labels = ['Q1', 'Q2', 'Q3', 'Q4'];
        break;
      case 'all':
        startDate = new Date(2020, 0, 1); // Far back date
        labels = ['2021', '2022', '2023', '2024', '2025'];
        break;
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching orders:', error);
      return { labels, datasets: [{ data: labels.map(() => 0) }] };
    }

    // Group orders by period
    const orderCounts = labels.map(() => 0);
    
    if (orders && orders.length > 0) {
      orders.forEach((order: any) => {
        const orderDate = new Date(order.created_at);
        
        if (period === '7days') {
          const dayOfWeek = orderDate.getDay();
          const index = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday=0 to index 6
          if (index >= 0 && index < 7) orderCounts[index]++;
        } else if (period === '1month') {
          const dayOfMonth = orderDate.getDate();
          const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), 3);
          orderCounts[weekIndex]++;
        } else if (period === '1year') {
          const month = orderDate.getMonth();
          const quarterIndex = Math.floor(month / 3);
          if (quarterIndex >= 0 && quarterIndex < 4) orderCounts[quarterIndex]++;
        } else if (period === 'all') {
          const year = orderDate.getFullYear();
          const yearIndex = year - 2021;
          if (yearIndex >= 0 && yearIndex < 5) orderCounts[yearIndex]++;
        }
      });
    }
    
    return { labels, datasets: [{ data: orderCounts }] };
  } catch (error) {
    console.error('Error generating chart data:', error);
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return { labels, datasets: [{ data: labels.map(() => 0) }] };
  }
};

export default function AdminHome() {
  const { profile } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('7days');
  const [chartData, setChartData] = useState<ChartData>({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    activeUsers: 0,
    inProductionOrders: 0,
    completedOrders: 0
  });

  // Fetch real stats from the database
  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        // Fetch total orders count
        const { count: ordersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true });

        // Fetch active users (packers with status != 'banned')
        const { count: usersCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'banned');

        // Fetch in-production orders
        const { count: inProductionCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('production_status', 'in_production');

        // Fetch completed orders
        const { count: completedCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('production_status', 'completed');

        setStats({
          totalOrders: ordersCount || 0,
          activeUsers: usersCount || 0,
          inProductionOrders: inProductionCount || 0,
          completedOrders: completedCount || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const fetchChartData = async () => {
      const data = await generateChartData(selectedPeriod);
      setChartData(data);
    };
    fetchChartData();
  }, [selectedPeriod]);

  const quickActions = [
    {
      title: 'Manage Orders',
      description: 'View and process customer orders',
      icon: ShoppingCart,
      color: 'bg-blue-500',
      onPress: () => console.log('Navigate to orders')
    },
    {
      title: 'User Management',
      description: 'Manage staff and customer accounts',
      icon: Users,
      color: 'bg-green-500',
      onPress: () => console.log('Navigate to users')
    },
    {
      title: 'View Reports',
      description: 'Access analytics and performance data',
      icon: TrendingUp,
      color: 'bg-purple-500',
      onPress: () => console.log('Navigate to reports')
    }
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 py-4 bg-white border-b border-gray-200">
          <Text className="text-2xl font-bold text-gray-900">
            Good morning, {profile?.full_name?.split(' ')[0]}! 👋
          </Text>
          <Text className="text-gray-600 mt-1">
            Here's what's happening with your business today
          </Text>
        </View>

        {/* Stats Cards */}
        <View className="px-6 py-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Overview
          </Text>
          
          <View className="flex-row mb-4">
            <StatCard
              title="Total Orders"
              value={stats.totalOrders.toString()}
              icon={ShoppingCart}
              color="bg-blue-500"
              loading={statsLoading}
            />
            <StatCard
              title="Active Users"
              value={stats.activeUsers.toString()}
              icon={Users}
              color="bg-green-500"
              loading={statsLoading}
            />
          </View>

          <View className="flex-row">
            <StatCard
              title="In Production"
              value={stats.inProductionOrders.toString()}
              icon={TrendingUp}
              color="bg-purple-500"
              loading={statsLoading}
            />
            <StatCard
              title="Completed"
              value={stats.completedOrders.toString()}
              icon={Clock}
              color="bg-orange-500"
              loading={statsLoading}
            />
          </View>
        </View>

        {/* Orders Chart */}
        <View className="px-6 py-4">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-semibold text-gray-900">
              Orders Overview
            </Text>
            <View className="flex-row items-center">
              <Calendar size={16} color="#6b7280" />
              <Text className="ml-2 text-sm text-gray-600">
                {selectedPeriod === '7days' && 'Last 7 Days'}
                {selectedPeriod === '1month' && 'Last Month'}
                {selectedPeriod === '1year' && 'Last Year'}
                {selectedPeriod === 'all' && 'All Time'}
              </Text>
            </View>
          </View>

          {/* Time Period Filters */}
          <View className="flex-row mb-4 space-x-2">
            {[
              { key: '7days', label: '7 Days' },
              { key: '1month', label: '1 Month' },
              { key: '1year', label: '1 Year' },
              { key: 'all', label: 'All Time' }
            ].map((period) => (
              <TouchableOpacity
                key={period.key}
                onPress={() => setSelectedPeriod(period.key as TimePeriod)}
                className={`px-4 py-2 rounded-lg ${
                  selectedPeriod === period.key
                    ? 'bg-primary-500'
                    : 'bg-gray-100'
                }`}
              >
                <Text className={`font-medium ${
                  selectedPeriod === period.key
                    ? 'text-white'
                    : 'text-gray-700'
                }`}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Chart */}
          <View className="bg-white rounded-lg shadow-sm">
            <ChartContainer
              className="p-4"
              config={{
                orders: {
                  label: 'Orders',
                  color: '#3b82f6'
                }
              }}
            >
              <OrdersBarChart
                data={chartData}
                className=""
              />
            </ChartContainer>
          </View>
        </View>

        {/* Recent Activity - Placeholder */}
        <View className="px-6 py-4">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </Text>
          
          <View className="bg-white rounded-lg shadow-sm p-4">
            <View className="items-center py-4">
              <Text className="text-gray-500 text-sm text-center">
                Activity feed coming soon
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-6 py-4 pb-8">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </Text>
          
          {quickActions.map((action, index) => (
            <QuickAction
              key={index}
              title={action.title}
              description={action.description}
              icon={action.icon}
              color={action.color}
              onPress={action.onPress}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
