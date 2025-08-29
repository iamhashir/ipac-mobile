import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { Eye, EyeOff } from 'lucide-react-native';
import { ErrorAlert } from '../../components/ui/Alert';
import { auth } from '../../utils/api/supabase';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorAlert, setErrorAlert] = useState<{visible: boolean, title: string, message?: string}>({visible: false, title: ''});
  const { user, profile, loading: authLoading, signIn } = useAuth();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isCompact = isLandscape && height < 450; // optimize for phone landscape heights (e.g., 390-430)

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
      
      let authResult;
      
      // Check if input looks like an email
      if (username.includes('@')) {
        // Sign in directly with email
        authResult = await signIn(username, password);
      } else {
        // Use username-based login - call the auth function directly
        authResult = await auth.signInWithUsername(username, password);
        
        // Note: Since we're bypassing the AuthContext signIn method,
        // the auth state change will still be detected by the auth listener
        // in AuthContext, so the user will be properly authenticated
      }
      
      const { data, error } = authResult;
      
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
    <SafeAreaView className="flex-1 bg-primary-50" edges={['top','bottom','left','right']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24, // px-6
            paddingVertical: 16,   // slightly tighter vertical padding for landscape
            minHeight: '100%'
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            className={`w-full bg-white rounded-lg xs:rounded-xl md:rounded-2xl ${isCompact ? 'p-3 max-w-md' : 'max-w-2xl p-3 xs:p-4 md:p-6'} shadow-lg border border-gray-200`}
            style={{ maxHeight: Math.max(320, height - 40) }}
          >
            {/* Header */}
            <View className={`${isCompact ? 'mb-2' : 'mb-3 xs:mb-4 md:mb-6'} items-center`}>
              <Text className={`${isCompact ? 'text-lg' : 'text-xl xs:text-2xl md:text-3xl'} font-bold text-gray-900 mb-1 md:mb-2`}>
                IPAC Operations
              </Text>
              {!isCompact && (
                <Text className="text-gray-600 text-sm xs:text-base md:text-lg text-center">
                  Industrial Packaging Management
                </Text>
              )}
            </View>

            {/* Error Alert */}
            <ErrorAlert
              visible={errorAlert.visible}
              title={errorAlert.title}
              message={errorAlert.message}
              onClose={() => setErrorAlert({visible: false, title: ''})}
              autoDismiss={true}
            />

            {/* Login Form */}
            <View className={isCompact ? 'space-y-4' : 'space-y-6'}>
              <View>
                <Text className={`text-xs xs:text-sm md:text-base text-gray-700 font-medium mb-2 ms-1`}>
                  Username
                </Text>
                <TextInput
                  className={`bg-white border border-gray-300 rounded-lg px-3 md:px-4 py-3 text-base`}
                  placeholder="Enter your username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View>
                <Text className={`text-xs xs:text-sm md:text-base text-gray-700 font-medium my-2 ms-1`}>
                  Password
                </Text>
                <View className="relative">
                  <TextInput
                    className={`bg-white border border-gray-300 rounded-lg px-3 md:px-4 py-3 pr-12 text-base`}
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    className={`absolute right-3 top-3.5`}
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
                className={`bg-primary-500 rounded-lg xs:mt-5 ${isCompact ? 'py-2' : 'py-3 xs:py-2 md:py-4'} items-center ${loading ? 'opacity-50' : ''}`}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text className={`${isCompact ? 'text-base' : 'text-sm xs:text-base md:text-lg'} text-white font-semibold`}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          {!isCompact && (
            <View className="mt-4 md:mt-6 items-center">
              <Text className="text-gray-500 text-[11px] xs:text-xs md:text-sm">
                IPAC Operations Management System
              </Text>
              <Text className="text-gray-400 text-[10px] xs:text-[11px] md:text-xs mt-1">
                Version 1.0.0
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
