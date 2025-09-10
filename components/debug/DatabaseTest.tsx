import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase, db } from '../../utils/api/supabase';

export function DatabaseTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{[key: string]: any}>({});

  const runTests = async () => {
    setTesting(true);
    const testResults: {[key: string]: any} = {};

    try {
      // Test 1: Basic connection
      console.log('🧪 Testing basic connection...');
      const { data: basicTest, error: basicError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      testResults.basicConnection = {
        success: !basicError,
        error: basicError?.message,
        data: basicTest
      };

      // Test 2: Profile fetch with roles
      console.log('🧪 Testing profile fetch with roles...');
      const { data: profileTest, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          username,
          roles (
            id,
            name
          )
        `)
        .limit(1);

      testResults.profileWithRoles = {
        success: !profileError,
        error: profileError?.message,
        data: profileTest
      };

      // Test 3: Test the getUserProfile function
      console.log('🧪 Testing getUserProfile function...');
      if (profileTest && profileTest.length > 0) {
        try {
          const { data: userProfileTest, error: userProfileError } = await db.getUserProfile(profileTest[0].id);
          testResults.getUserProfile = {
            success: !userProfileError,
            error: userProfileError?.message,
            data: userProfileTest
          };
        } catch (err) {
          testResults.getUserProfile = {
            success: false,
            error: err.message,
            data: null
          };
        }
      }

      // Test 4: Auth session
      console.log('🧪 Testing auth session...');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      testResults.authSession = {
        success: !sessionError,
        error: sessionError?.message,
        hasSession: !!sessionData.session,
        user: sessionData.session?.user?.email || null
      };

    } catch (error) {
      testResults.generalError = {
        success: false,
        error: error.message
      };
    }

    setResults(testResults);
    setTesting(false);
  };

  return (
    <View className="p-4 bg-white rounded-lg shadow-sm m-4">
      <Text className="text-lg font-bold mb-4">🗄️ Database Test</Text>
      
      <TouchableOpacity
        onPress={runTests}
        disabled={testing}
        className={`p-3 rounded-lg mb-4 ${testing ? 'bg-gray-300' : 'bg-blue-500'}`}
      >
        <Text className="text-white text-center font-medium">
          {testing ? 'Testing...' : 'Run Database Tests'}
        </Text>
      </TouchableOpacity>

      {testing && (
        <View className="flex-row justify-center mb-4">
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      )}

      {Object.keys(results).length > 0 && (
        <View className="bg-gray-50 p-3 rounded-lg">
          <Text className="font-semibold mb-2">Test Results:</Text>
          {Object.entries(results).map(([testName, result]) => (
            <View key={testName} className="mb-2">
              <Text className={`text-sm font-medium ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                {testName}: {result.success ? '✅ Success' : '❌ Failed'}
              </Text>
              {result.error && (
                <Text className="text-xs text-red-500 ml-2">
                  Error: {result.error}
                </Text>
              )}
              {result.data && (
                <Text className="text-xs text-gray-600 ml-2">
                  Data: {JSON.stringify(result.data, null, 1)}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
