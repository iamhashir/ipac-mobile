import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  UserCheck,
  Eye,
} from "lucide-react-native";
import { supabase } from "../../utils/api/supabase";
import AssignmentsBoard from "../../components/admin/users/AssignmentsBoard";
import { useRouter } from "expo-router";
import { useAuth } from "../../utils/AuthContext";

interface StaffUser {
  id: string;
  full_name: string;
  username: string;
  phone_number?: string;
  base_role: string;
  status: "active" | "blocked" | "banned";
  packer_status?: "available" | "busy" | "unavailable";
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

function UserCard({
  user,
  onView,
}: {
  user: StaffUser;
  onView?: (id: string) => void;
}) {
  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "director":
        return "bg-purple-100 text-purple-800";
      case "sales":
        return "bg-blue-100 text-blue-800";
      case "packer":
        return "bg-green-100 text-green-800";
      case "customer":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    return status === "active"
      ? "bg-green-100 text-green-800"
      : "bg-red-100 text-red-800";
  };

  return (
    <View className="bg-white rounded-lg shadow-sm p-4 mb-3 border border-gray-400">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900">
            {user.full_name}
          </Text>
          <Text className="text-sm text-gray-600">@{user.username}</Text>
          {user.phone_number && (
            <Text className="text-sm text-gray-600">{user.phone_number}</Text>
          )}
        </View>
        <View className="flex-row space-x-2">
          <View
            className={`px-2 py-1 rounded-full ${getRoleColor(user.base_role)}`}
          >
            <Text className="text-xs font-medium capitalize">
              {user.base_role}
            </Text>
          </View>
          <View
            className={`px-2 py-1 rounded-full ${getStatusColor(user.status)}`}
          >
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
        <TouchableOpacity
          className="flex-1 bg-blue-50 py-2 px-3 rounded-lg flex-row items-center justify-center border border-blue-400"
          onPress={() => onView?.(user.id)}
        >
          <Eye size={16} color="#1d4ed8" />
          <Text className="ml-2 text-blue-700 font-medium">View</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 bg-blue-50 py-2 px-3 rounded-lg flex-row items-center justify-center border border-indigo-400">
          <Edit3 size={16} color="#4f46e5" />
          <Text className="ml-2 text-indigo-600 font-medium">Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity className="flex-1 bg-green-50 py-2 px-3 rounded-lg flex-row items-center justify-center border border-green-400">
          <UserCheck size={16} color="#10b981" />
          <Text className="ml-2 text-green-600 font-medium">
            {user.status === "active" ? "Block" : "Activate"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity className="bg-red-50 py-2 px-3 rounded-lg flex-row items-center justify-center border border-red-400">
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();
  const router = useRouter();

  // Create User modal state
  const [addOpen, setAddOpen] = useState(false);
  const [rolesList, setRolesList] = useState<string[]>([]);
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<string>("packer");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        // Fetch users
        const { data, error } = await supabase
          .from("user_effective_permissions")
          .select("*")
          .not("base_role", "eq", "customer");
        if (error) throw error;
        setUsers(data || []);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from("roles")
          .select("name")
          .order("name");
        if (!error) {
          const names = (data || [])
            .map((r: any) => r.name)
            .filter((n: string) => n !== "customer");
          setRolesList(names);
          if (!names.includes(formRole) && names.length) setFormRole(names[0]);
        }
      } catch {}
    };

    fetchUsers();
    fetchRoles();
  }, []);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole =
      selectedRole === "all" || user.base_role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const roles = [
    { key: "all", label: "All Users", count: users.length },
    {
      key: "admin",
      label: "Admin",
      count: users.filter((u) => u.base_role === "admin").length,
    },
    {
      key: "director",
      label: "Director",
      count: users.filter((u) => u.base_role === "director").length,
    },
    {
      key: "sales",
      label: "Sales",
      count: users.filter((u) => u.base_role === "sales").length,
    },
    {
      key: "packer",
      label: "Packer",
      count: users.filter((u) => u.base_role === "packer").length,
    },
    {
      key: "team_lead",
      label: "Team Lead",
      count: users.filter((u) => u.base_role === "team_lead").length,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-6 py-4 bg-white border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-bold text-gray-900">
            User Management
          </Text>
          <TouchableOpacity
            className="bg-blue-50 border border-blue-600 px-4 py-2 rounded-lg flex-row items-center"
            onPress={() => setAddOpen(true)}
          >
            <Plus size={16} color="#1d4ed8" />
            <Text className="ml-2 text-blue-700 font-medium">Add User</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar moved below orders */}
        {/* Role Filter Tabs moved below orders */}
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-6 pt-2 pb-4"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Assignments Board */}
        <AssignmentsBoard />

        {/* Filters (moved here) */}
        {/* Search Bar */}
		<View className="my-8 border-t border-dashed border-gray-400" />
        <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3 mb-4 border border-gray-400">
          <Search size={20} color="#6b7280" />
          <TextInput
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 text-gray-900"
          />
        </View>
        <View className="mt-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-2"
          >
            <View className="flex-row px-2">
              {roles.map((role) => (
                <TouchableOpacity
                  key={role.key}
                  onPress={() => setSelectedRole(role.key)}
                  className={`mr-3 px-4 py-2 rounded-full ${
                    selectedRole === role.key ? "bg-primary-500" : "bg-gray-200"
                  }`}
                >
                  <Text
                    className={`font-medium ${
                      selectedRole === role.key ? "text-white" : "text-gray-700"
                    }`}
                  >
                    {role.label} ({role.count})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Users List */}
        <View className="mt-4">
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
                    Active:{" "}
                    {filteredUsers.filter((u) => u.status === "active").length}
                  </Text>
                  <Text className="text-sm text-gray-500">•</Text>
                  <Text className="text-sm text-gray-500">
                    Blocked/Banned:{" "}
                    {filteredUsers.filter((u) => u.status !== "active").length}
                  </Text>
                </View>
              </View>

              {filteredUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onView={(id) => router.push(`/(admin)/users/${id}`)}
                />
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
        </View>
      </ScrollView>
      {/* Add User Modal */}
      <Modal
        visible={addOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddOpen(false)}
      >
        <View className="flex-1 bg-black/40 justify-center items-center">
          <View className="w-11/12 bg-white rounded-lg p-4">
            <Text className="text-lg font-semibold text-gray-800 mb-3">
              Create User
            </Text>

            <View className="mb-2">
              <Text className="text-sm text-gray-700 mb-1">
                Full name<Text className="text-red-600">*</Text>
              </Text>
              <TextInput
                value={formFullName}
                onChangeText={setFormFullName}
                placeholder="e.g. Jane Doe"
                className="border border-gray-300 rounded p-2 bg-white"
              />
            </View>

            <View className="mb-2">
              <Text className="text-sm text-gray-700 mb-1">
                Email<Text className="text-red-600">*</Text>
              </Text>
              <TextInput
                value={formEmail}
                onChangeText={setFormEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="name@example.com"
                className="border border-gray-300 rounded p-2 bg-white"
              />
            </View>

            <View className="mb-2">
              <Text className="text-sm text-gray-700 mb-1">Username</Text>
              <TextInput
                value={formUsername}
                onChangeText={setFormUsername}
                autoCapitalize="none"
                placeholder="optional"
                className="border border-gray-300 rounded p-2 bg-white"
              />
            </View>

            <View className="mb-2">
              <Text className="text-sm text-gray-700 mb-1">
                Password<Text className="text-red-600">*</Text>
              </Text>
              <TextInput
                value={formPassword}
                onChangeText={setFormPassword}
                secureTextEntry
                placeholder="••••••••"
                className="border border-gray-300 rounded p-2 bg-white"
              />
            </View>

            <View className="mb-3">
              <Text className="text-sm text-gray-700 mb-1">
                Role<Text className="text-red-600">*</Text>
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row">
                  {rolesList.map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setFormRole(r)}
                      className={`mr-2 px-3 py-2 rounded-full ${
                        formRole === r
                          ? "bg-blue-50 border border-blue-600"
                          : "bg-gray-100 border border-gray-300"
                      }`}
                    >
                      <Text
                        className={`${
                          formRole === r ? "text-blue-700" : "text-gray-700"
                        }`}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View className="flex-row justify-end gap-2 mt-2">
              <TouchableOpacity
                onPress={() => setAddOpen(false)}
                className="px-3 py-2 rounded bg-gray-200"
              >
                <Text className="text-gray-800">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (
                    !formFullName ||
                    !formEmail ||
                    !formPassword ||
                    !formRole
                  ) {
                    Alert.alert(
                      "Missing fields",
                      "Please fill in full name, email, password and role."
                    );
                    return;
                  }
                  try {
                    setSubmitting(true);
                    const { data, error } = await supabase.functions.invoke(
                      "create-user",
                      {
                        body: {
                          email: formEmail,
                          password: formPassword,
                          full_name: formFullName,
                          username: formUsername || null,
                          role_name: formRole,
                        },
                      }
                    );
                    if (error) throw error;
                    // Refresh list
                    const { data: refreshed } = await supabase
                      .from("user_effective_permissions")
                      .select("*")
                      .not("base_role", "eq", "customer");
                    setUsers(refreshed || []);
                    setAddOpen(false);
                    setFormFullName("");
                    setFormEmail("");
                    setFormUsername("");
                    setFormPassword("");
                    Alert.alert("Success", "User created successfully");
                  } catch (err: any) {
                    Alert.alert(
                      "Error",
                      err?.message || "Failed to create user"
                    );
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className={`px-3 py-2 rounded ${
                  submitting
                    ? "bg-gray-300"
                    : "bg-blue-50 border border-blue-600"
                }`}
              >
                <Text
                  className={`${
                    submitting ? "text-gray-600" : "text-blue-700"
                  }`}
                >
                  {submitting ? "Creating..." : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
