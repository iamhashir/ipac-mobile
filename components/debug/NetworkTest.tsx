import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../utils/api/supabase';

export function NetworkTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string>('');

  const testConnection = async () => {
    setTesting(true);
    setResult('Testing...');
    
    try {
      // Test 1: Basic Supabase connection
      console.log('🔍 Testing Supabase connection...');
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('❌ Supabase test failed:', error);
        setResult(`❌ Supabase Error: ${error.message}`);
      } else {
        console.log('✅ Supabase connection successful');
        setResult('✅ Supabase connection works!');
        
        // Test 2: Try the specific function that's failing
        try {
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_user_email_by_username', {
              lookup_username: 'test'
            });
          
          if (rpcError) {
            setResult(prev => `${prev}\n❌ RPC Error: ${rpcError.message}`);
          } else {
            setResult(prev => `${prev}\n✅ RPC function works!`);
          }
        } catch (rpcErr) {
          setResult(prev => `${prev}\n❌ RPC Exception: ${rpcErr}`);
        }
      }
    } catch (err) {
      console.error('💥 Network test exception:', err);
      setResult(`💥 Network Error: ${err}`);
    } finally {
      setTesting(false);
    }
  };

  const testBasicFetch = async () => {
    setTesting(true);
    setResult('Testing basic fetch...');
    
    // Check environment variables first
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('🔍 Environment check:', {
      supabaseUrl: supabaseUrl ? 'loaded' : 'missing',
      supabaseKey: supabaseKey ? 'loaded' : 'missing'
    });
    
    if (!supabaseUrl || !supabaseKey) {
      setResult(`❌ Environment variables missing:\nURL: ${supabaseUrl ? 'OK' : 'MISSING'}\nKey: ${supabaseKey ? 'OK' : 'MISSING'}`);
      setTesting(false);
      return;
    }
    
    try {
      const response = await fetch('https://httpbin.org/get');
      if (response.ok) {
        setResult('✅ Internet connection works!');
        
        // Now test Supabase URL specifically
        const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
          headers: {
            'apikey': supabaseKey,
            'authorization': `Bearer ${supabaseKey}`,
          }
        });
        
        if (supabaseResponse.ok) {
          setResult(prev => `${prev}\n✅ Supabase URL accessible!`);
        } else {
          setResult(prev => `${prev}\n❌ Supabase URL issue: ${supabaseResponse.status}`);
        }
      } else {
        setResult(`❌ Internet issue: ${response.status}`);
      }
    } catch (err) {
      setResult(`❌ Fetch failed: ${err}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View className="p-4 bg-gray-100 rounded-lg m-4">
      <Text className="text-lg font-bold mb-4">Network Debug</Text>
      
      <TouchableOpacity
        className="bg-blue-500 p-3 rounded mb-2"
        onPress={testBasicFetch}
        disabled={testing}
      >
        <Text className="text-white text-center">Test Internet & Supabase URL</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        className="bg-green-500 p-3 rounded mb-2"
        onPress={testConnection}
        disabled={testing}
      >
        <Text className="text-white text-center">Test Supabase Connection</Text>
      </TouchableOpacity>
      
      {result ? (
        <View className="bg-white p-3 rounded mt-2">
          <Text className="text-sm">{result}</Text>
        </View>
      ) : null}
    </View>
  );
}
