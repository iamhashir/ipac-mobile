import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
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
}

function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  return (
    <View className="bg-white rounded-lg shadow-sm p-4 flex-1 mx-1">
      <View className="flex-row items-center justify-between mb-2">
        <View className={`p-2 rounded-lg ${color}`}>
          <Icon size={20} color="white" />
        </View>
      </View>
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
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
    let dateFilter = '';
    let labels: string[] = [];
    
    switch (period) {
      case '7days':
        dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        break;
      case '1month':
        dateFilter = "created_at >= NOW() - INTERVAL '1 month'";
        labels = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];
        break;
      case '1year':
        dateFilter = "created_at >= NOW() - INTERVAL '1 year'";
        labels = ['Q1', 'Q2', 'Q3', 'Q4'];
        break;
      case 'all':
        dateFilter = "1=1"; // No filter for all time
        labels = ['2021', '2022', '2023', '2024', '2025'];
        break;
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching orders:', error);
      // Return mock data as fallback
      return { labels, datasets: [{ data: labels.map(() => Math.floor(Math.random() * 30) + 10) }] };
    }

    // For now, return aggregated data based on period
    // This is simplified - you could make this more sophisticated
    const data = labels.map(() => Math.floor(Math.random() * 30) + 10); // Temporary random data
    
    return { labels, datasets: [{ data }] };
  } catch (error) {
    console.error('Error generating chart data:', error);
    // Return fallback mock data
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return { labels, datasets: [{ data: [12, 19, 8, 25, 22, 18, 24] }] };
  }
};

export default function AdminHome() {
  const { profile } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('7days');
  const [chartData, setChartData] = useState<ChartData>({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{ data: [12, 19, 8, 25, 22, 18, 24] }]
  });

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
            Today's Overview
          </Text>
          
          <View className="flex-row mb-4">
            <StatCard
              title="Total Orders"
              value="24"
              icon={ShoppingCart}
              color="bg-blue-500"
              subtitle="+12% from yesterday"
            />
            <StatCard
              title="Active Users"
              value="156"
              icon={Users}
              color="bg-green-500"
              subtitle="+5 new today"
            />
          </View>

          <View className="flex-row">
            <StatCard
              title="Revenue"
              value="AED 45,280"
              icon={TrendingUp}
              color="bg-purple-500"
              subtitle="+8% from yesterday"
            />
            <StatCard
              title="Pending Orders"
              value="7"
              icon={Clock}
              color="bg-orange-500"
              subtitle="Need attention"
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

        {/* Recent Activity */}
        <View className="px-6 py-4">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </Text>
          
          <View className="bg-white rounded-lg shadow-sm p-4">
            <View className="space-y-4">
              <View className="flex-row items-center">
                <View className="w-2 h-2 bg-green-500 rounded-full mr-3" />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-900">
                    New order #1023 received
                  </Text>
                  <Text className="text-xs text-gray-500">2 minutes ago</Text>
                </View>
              </View>
              
              <View className="flex-row items-center">
                <View className="w-2 h-2 bg-blue-500 rounded-full mr-3" />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-900">
                    Order #1019 marked as completed
                  </Text>
                  <Text className="text-xs text-gray-500">15 minutes ago</Text>
                </View>
              </View>
              
              <View className="flex-row items-center">
                <View className="w-2 h-2 bg-purple-500 rounded-full mr-3" />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-900">
                    New user registered: John Smith
                  </Text>
                  <Text className="text-xs text-gray-500">1 hour ago</Text>
                </View>
              </View>
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
