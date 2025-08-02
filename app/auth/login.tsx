import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { Eye, EyeOff } from 'lucide-react-native';
import { ErrorAlert } from '../../components/ui/Alert';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorAlert, setErrorAlert] = useState<{visible: boolean, title: string, message?: string}>({visible: false, title: ''});
  const { user, profile, loading: authLoading, signIn } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user && profile) {
      console.log('🔄 Login: User already authenticated, redirecting...');
      const userRole = profile.roles?.name;
      
      if (userRole === 'admin' || userRole === 'director' || userRole === 'sales') {
        router.replace('/(admin)/dashboard');
      } else if (userRole === 'packer') {
        router.replace('/(packer)/dashboard');
      } else {
        router.replace('/');
      }
    }
  }, [user, profile, authLoading, router]);

  const handleLogin = async () => {
    if (!username || !password) {
      setErrorAlert({visible: true, title: 'Missing Credentials', message: 'Please enter both username and password'});
      return;
    }

    setLoading(true);
    
    try {
      console.log('🔐 Attempting login with username:', username);
      
      // For Supabase auth, we need to convert username to email format
      // Assuming username maps to email in your system
      const emailForAuth = username.includes('@') ? username : `${username}@ipac.local`;
      const { data, error } = await signIn(emailForAuth, password);
      
      console.log('🔐 Login response:', { 
        user: data?.user?.email, 
        error: error?.message,
        session: data?.session ? 'exists' : 'none'
      });
      
      if (error) {
        console.error('🚫 Login error:', error);
        setErrorAlert({visible: true, title: 'Login Failed', message: error.message || 'Invalid username or password'});
      } else if (data?.user) {
        console.log('✅ Login successful, auth context will handle navigation');
        // Navigation will be handled by the index page when auth state updates
        // Clear the form
        setUsername('');
        setPassword('');
      }
    } catch (error) {
      console.error('💥 Unexpected login error:', error);
      setErrorAlert({visible: true, title: 'Login Error', message: 'An unexpected error occurred. Please try again.'});
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          {/* Header */}
          <View className="items-center mb-12">
            <Text className="text-3xl font-bold text-gray-900 mb-2">
              IPAC Operations
            </Text>
            <Text className="text-gray-600 text-lg">
              Industrial Packaging Management
            </Text>
          </View>

          {/* Error Alert */}
          <ErrorAlert
            visible={errorAlert.visible}
            title={errorAlert.title}
            message={errorAlert.message}
            onClose={() => setErrorAlert({visible: false, title: ''})}
          />

          {/* Login Form */}
          <View className="space-y-6">
            <View>
              <Text className="text-gray-700 text-base font-medium mb-2">
                Username
              </Text>
              <TextInput
                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-base"
                placeholder="Enter your username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View>
              <Text className="text-gray-700 text-base font-medium mb-2">
                Password
              </Text>
              <View className="relative">
                <TextInput
                  className="bg-white border border-gray-300 rounded-lg px-4 py-3 pr-12 text-base"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  className="absolute right-3 top-3"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#6B7280" />
                  ) : (
                    <Eye size={20} color="#6B7280" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              className={`bg-primary-500 rounded-lg py-4 items-center ${loading ? 'opacity-50' : ''}`}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text className="text-white text-lg font-semibold">
                {loading ? 'Signing In...' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="mt-12 items-center">
            <Text className="text-gray-500 text-sm">
              IPAC Operations Management System
            </Text>
            <Text className="text-gray-400 text-xs mt-1">
              Version 1.0.0
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
