import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Edit3, Trash2, UserCheck, Clock, Shield, Crown } from 'lucide-react-native';
import { supabase } from '../../utils/api/supabase';
import { useAuth } from '../../utils/AuthContext';

interface StaffUser {
  id: string;
  full_name: string;
  username: string;
  phone_number?: string;
  base_role: string;
  status: 'active' | 'blocked' | 'banned';
  packer_status?: 'available' | 'busy' | 'unavailable';
  created_at: string;
  // Effective permissions (base role + temporary privileges)
  effective_can_block_users: boolean;
  effective_can_unblock_users: boolean;
  effective_can_ban_users: boolean;
  effective_can_reset_passwords: boolean;
  effective_can_delete_profiles: boolean;
  effective_can_manage_roles: boolean;
  // Active temporary privileges
  active_temp_privileges?: Array<{
    role_name: string;
    expires_at: string;
    reason: string;
    granted_by: string;
  }>;
}

interface Role {
  id: string;
  name: string;
  can_block_users: boolean;
  can_unblock_users: boolean;
  can_ban_users: boolean;
  can_reset_passwords: boolean;
  can_delete_profiles: boolean;
  can_manage_roles: boolean;
}

function UserCard({ user }: { user: StaffUser }) {
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'director': return 'bg-purple-100 text-purple-800';
      case 'sales': return 'bg-blue-100 text-blue-800';
      case 'packer': return 'bg-green-100 text-green-800';
      case 'customer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  return (
    <View className="bg-white rounded-lg shadow-sm p-4 mb-3">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900">
            {user.full_name}
          </Text>
          <Text className="text-sm text-gray-600">
            @{user.username}
          </Text>
          {user.phone_number && (
            <Text className="text-sm text-gray-600">
              {user.phone_number}
            </Text>
          )}
        </View>
        <View className="flex-row space-x-2">
          <View className={`px-2 py-1 rounded-full ${getRoleColor(user.base_role)}`}>
            <Text className="text-xs font-medium capitalize">
              {user.base_role}
            </Text>
          </View>
          <View className={`px-2 py-1 rounded-full ${getStatusColor(user.status)}`}>
            <Text className="text-xs font-medium capitalize">
              {user.status}
            </Text>
          </View>
        </View>
      </View>
      
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-sm text-gray-500">
          Joined: {new Date(user.created_at).toLocaleDateString()}
        </Text>
        {user.packer_status && (
          <Text className="text-sm text-gray-500">
            Packer Status: {user.packer_status}
          </Text>
        )}
      </View>

      <View className="flex-row space-x-2">
        <TouchableOpacity className="flex-1 bg-blue-50 py-2 px-3 rounded-lg flex-row items-center justify-center">
          <Edit3 size={16} color="#3b82f6" />
          <Text className="ml-2 text-blue-600 font-medium">Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity className="flex-1 bg-green-50 py-2 px-3 rounded-lg flex-row items-center justify-center">
          <UserCheck size={16} color="#10b981" />
          <Text className="ml-2 text-green-600 font-medium">
            {user.status === 'active' ? 'Block' : 'Activate'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity className="bg-red-50 py-2 px-3 rounded-lg flex-row items-center justify-center">
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        
        // Fetch users from the user_effective_permissions view which includes roles and permissions
        const { data, error } = await supabase
          .from('user_effective_permissions')
          .select('*')
          .not('base_role', 'eq', 'customer'); // Exclude customers from staff management
        
        if (error) throw error;
        
        setUsers(data || []);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.base_role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const roles = [
    { key: 'all', label: 'All Users', count: users.length },
    { key: 'admin', label: 'Admin', count: users.filter(u => u.base_role === 'admin').length },
    { key: 'director', label: 'Director', count: users.filter(u => u.base_role === 'director').length },
    { key: 'sales', label: 'Sales', count: users.filter(u => u.base_role === 'sales').length },
    { key: 'packer', label: 'Packer', count: users.filter(u => u.base_role === 'packer').length },
    { key: 'team_lead', label: 'Team Lead', count: users.filter(u => u.base_role === 'team_lead').length }
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-6 py-4 bg-white border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-bold text-gray-900">
            User Management
          </Text>
          <TouchableOpacity className="bg-primary-500 px-4 py-2 rounded-lg flex-row items-center">
            <Plus size={16} color="white" />
            <Text className="ml-2 text-white font-medium">Add User</Text>
          </TouchableOpacity>
        </View>
        
        {/* Search Bar */}
        <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3 mb-4">
          <Search size={20} color="#6b7280" />
          <TextInput
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 text-gray-900"
          />
        </View>

        {/* Role Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2">
          <View className="flex-row px-2">
            {roles.map((role) => (
              <TouchableOpacity
                key={role.key}
                onPress={() => setSelectedRole(role.key)}
                className={`mr-3 px-4 py-2 rounded-full ${
                  selectedRole === role.key
                    ? 'bg-primary-500'
                    : 'bg-gray-200'
                }`}
              >
                <Text className={`font-medium ${
                  selectedRole === role.key
                    ? 'text-white'
                    : 'text-gray-700'
                }`}>
                  {role.label} ({role.count})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Users List */}
      <ScrollView className="flex-1 px-6 py-4">
        {loading ? (
          <View className="flex-1 justify-center items-center py-12">
            <ActivityIndicator size="large" color="#0891b2" />
            <Text className="text-gray-500 mt-4">Loading users...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center py-12">
            <Text className="text-red-500 text-lg">{error}</Text>
            <TouchableOpacity 
              className="mt-4 bg-primary-500 px-4 py-2 rounded-lg"
              onPress={() => window.location.reload()}
            >
              <Text className="text-white font-medium">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-semibold text-gray-900">
                {filteredUsers.length} Users Found
              </Text>
              <View className="flex-row space-x-2">
                <Text className="text-sm text-gray-500">
                  Active: {filteredUsers.filter(u => u.status === 'active').length}
                </Text>
                <Text className="text-sm text-gray-500">•</Text>
                <Text className="text-sm text-gray-500">
                  Blocked/Banned: {filteredUsers.filter(u => u.status !== 'active').length}
                </Text>
              </View>
            </View>

            {filteredUsers.map((user) => (
              <UserCard key={user.id} user={user} />
            ))}

            {filteredUsers.length === 0 && (
              <View className="flex-1 justify-center items-center py-12">
                <Text className="text-gray-500 text-lg">No users found</Text>
                <Text className="text-gray-400 text-sm mt-2">
                  Try adjusting your search or role filter
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
