import React, { useState, useEffect, Suspense, lazy } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Filter, Eye, Edit3, CheckCircle, Plus } from 'lucide-react-native';
import { supabase } from '../../utils/api/supabase';
const AddOrderModal = lazy(() => import('./components/AddOrderModal'));

interface Order {
  id: string;
  order_name: string;
  client_name: string;
  total_estimated_cost: number | null;
  commercial_status: 'draft' | 'quoted' | 'approved' | 'invoiced' | 'paid';
  production_status: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  created_at: string;
  description: string | null;
}

// Real orders will be fetched from database

function OrderCard({ order }: { order: Order }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'on_hold': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'quoted': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <View className="bg-white rounded-lg shadow-sm p-4 mb-3">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900">
            {order.order_name}
          </Text>
          <Text className="text-sm text-gray-600">
            {order.client_name}
          </Text>
          {order.description && (
            <Text className="text-xs text-gray-500 mt-1">
              {order.description}
            </Text>
          )}
        </View>
        <View className="flex-col items-end">
          <View className={`px-3 py-1 rounded-full mb-1 ${getStatusColor(order.production_status)}`}>
            <Text className="text-xs font-medium capitalize">
              {order.production_status.replace('_', ' ')}
            </Text>
          </View>
          <View className={`px-3 py-1 rounded-full ${getStatusColor(order.commercial_status)}`}>
            <Text className="text-xs font-medium capitalize">
              {order.commercial_status}
            </Text>
          </View>
        </View>
      </View>
      
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-xl font-bold text-gray-900">
          {order.total_estimated_cost ? `AED ${order.total_estimated_cost.toLocaleString()}` : 'Not quoted'}
        </Text>
        <Text className="text-sm text-gray-500">
          Created: {new Date(order.created_at).toLocaleDateString()}
        </Text>
      </View>

      <View className="flex-row space-x-2">
        <TouchableOpacity className="flex-1 bg-blue-50 py-2 px-3 rounded-lg flex-row items-center justify-center">
          <Eye size={16} color="#3b82f6" />
          <Text className="ml-2 text-blue-600 font-medium">View</Text>
        </TouchableOpacity>
        
        <TouchableOpacity className="flex-1 bg-green-50 py-2 px-3 rounded-lg flex-row items-center justify-center">
          <Edit3 size={16} color="#10b981" />
          <Text className="ml-2 text-green-600 font-medium">Edit</Text>
        </TouchableOpacity>
        
        {order.production_status === 'pending' && (
          <TouchableOpacity className="flex-1 bg-purple-50 py-2 px-3 rounded-lg flex-row items-center justify-center">
            <CheckCircle size={16} color="#8b5cf6" />
            <Text className="ml-2 text-purple-600 font-medium">Start</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_name,
          description,
          commercial_status,
          production_status,
          total_estimated_cost,
          created_at,
          clients(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedOrders: Order[] = data.map((order: any) => ({
        ...order,
        client_name: order.clients?.name || 'Unknown Client'
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.client_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || 
                         order.production_status === selectedFilter ||
                         order.commercial_status === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const filters = [
    { key: 'all', label: 'All Orders', count: orders.length },
    { key: 'pending', label: 'Pending', count: orders.filter(o => o.production_status === 'pending').length },
    { key: 'in_progress', label: 'In Progress', count: orders.filter(o => o.production_status === 'in_progress').length },
    { key: 'completed', label: 'Completed', count: orders.filter(o => o.production_status === 'completed').length },
    { key: 'draft', label: 'Draft', count: orders.filter(o => o.commercial_status === 'draft').length }
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-6 py-4 bg-white border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-bold text-gray-900">
            Order Management
          </Text>
          <TouchableOpacity 
            onPress={() => setShowAddModal(true)}
            className="bg-primary-500 px-4 py-2 rounded-lg flex-row items-center"
          >
            <Plus size={16} color="white" />
            <Text className="ml-2 text-white font-medium">Add Order</Text>
          </TouchableOpacity>
          {showAddModal && (
            <Suspense fallback={<View className="p-4"><Text>Loading form...</Text></View>}>
              <AddOrderModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
            </Suspense>
          )}
        </View>
        
        {/* Search Bar */}
        <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3 mb-4">
          <Search size={20} color="#6b7280" />
          <TextInput
            placeholder="Search orders or customers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 text-gray-900"
          />
        </View>

        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2">
          <View className="flex-row px-2">
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter.key}
                onPress={() => setSelectedFilter(filter.key)}
                className={`mr-3 px-4 py-2 rounded-full ${
                  selectedFilter === filter.key
                    ? 'bg-primary-500'
                    : 'bg-gray-200'
                }`}
              >
                <Text className={`font-medium ${
                  selectedFilter === filter.key
                    ? 'text-white'
                    : 'text-gray-700'
                }`}>
                  {filter.label} ({filter.count})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Orders List */}
      <ScrollView className="flex-1 px-6 py-4">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-semibold text-gray-900">
            {filteredOrders.length} Orders Found
          </Text>
          <TouchableOpacity className="flex-row items-center bg-primary-500 px-4 py-2 rounded-lg">
            <Filter size={16} color="white" />
            <Text className="ml-2 text-white font-medium">Filter</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center py-12">
            <Text className="text-gray-500 text-lg">Loading orders...</Text>
          </View>
        ) : (
          filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))
        )}

        {filteredOrders.length === 0 && (
          <View className="flex-1 justify-center items-center py-12">
            <Text className="text-gray-500 text-lg">No orders found</Text>
            <Text className="text-gray-400 text-sm mt-2">
              Try adjusting your search or filters
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Order Modal */}
      <AddOrderModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onOrderAdded={fetchOrders}
      />
    </SafeAreaView>
  );
}
