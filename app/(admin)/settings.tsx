import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings2, Database, Bell, Shield, AlertTriangle, X, Save } from 'lucide-react-native';
import { supabase } from '../../utils/api/supabase';

export default function SettingsPage() {
  const [showPriceAlerts, setShowPriceAlerts] = useState(false);
  const [priceSettings, setPriceSettings] = useState({
    warning_days: 90,
    alert_days: 180,
    enabled: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPriceSettings();
  }, []);

  const loadPriceSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'price_alert_thresholds')
        .single();
      
      if (data?.value) {
        setPriceSettings(data.value);
      }
    } catch (error) {
      console.error('Error loading price settings:', error);
    }
  };

  const savePriceSettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'price_alert_thresholds',
          value: priceSettings,
          description: 'Thresholds for supplier pricing age alerts (in days)',
          category: 'inventory'
        }, {
          onConflict: 'key'
        });
      
      if (error) throw error;
      
      Alert.alert('Success', 'Price alert settings saved successfully');
      setShowPriceAlerts(false);
    } catch (error) {
      console.error('Error saving price settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const settingsSections = [
    {
      title: 'Price Alert Configuration',
      icon: AlertTriangle,
      description: 'Set thresholds for price age warnings',
      action: () => setShowPriceAlerts(true)
    },
    {
      title: 'System Configuration',
      icon: Settings2,
      description: 'Configure app settings and preferences'
    },
    {
      title: 'Database Management',
      icon: Database,
      description: 'Manage database backups and maintenance'
    },
    {
      title: 'Notifications',
      icon: Bell,
      description: 'Configure system notifications'
    },
    {
      title: 'Security Settings',
      icon: Shield,
      description: 'Manage security policies and permissions'
    }
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-6 py-4">
        <Text className="text-2xl font-bold text-gray-900 mb-6">System Settings</Text>
        
        {settingsSections.map((section, index) => {
          const Icon = section.icon;
          return (
            <TouchableOpacity
              key={index}
              className="bg-white rounded-lg shadow-sm p-4 mb-3 flex-row items-center"
              onPress={section.action}
            >
              <View className="bg-primary-100 p-3 rounded-lg mr-4">
                <Icon size={24} color="#3b82f6" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900">
                  {section.title}
                </Text>
                <Text className="text-sm text-gray-600">
                  {section.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Price Alert Configuration Modal */}
      <Modal visible={showPriceAlerts} animationType="slide" transparent>
        <View className="flex-1 bg-black bg-opacity-50 justify-center items-center p-4">
          <View className="bg-white rounded-2xl w-full max-w-lg p-6">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xl font-bold text-gray-900">
                  Price Alert Configuration
                </Text>
                <Text className="text-sm text-gray-600 mt-1">
                  Set when to show price age warnings
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPriceAlerts(false)}
                className="p-2 rounded-full bg-gray-100"
              >
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Warning Threshold */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Warning Threshold (days)
              </Text>
              <View className="flex-row items-center">
                <TextInput
                  value={String(priceSettings.warning_days)}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setPriceSettings(prev => ({ ...prev, warning_days: num }));
                  }}
                  keyboardType="number-pad"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
                />
                <View className="ml-3 bg-yellow-100 px-3 py-2 rounded-lg">
                  <Text className="text-yellow-700 text-sm">⚠️ Warning</Text>
                </View>
              </View>
              <Text className="text-xs text-gray-500 mt-1">
                Show warning icon when price is older than {priceSettings.warning_days} days
              </Text>
            </View>

            {/* Alert Threshold */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Alert Threshold (days)
              </Text>
              <View className="flex-row items-center">
                <TextInput
                  value={String(priceSettings.alert_days)}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setPriceSettings(prev => ({ ...prev, alert_days: num }));
                  }}
                  keyboardType="number-pad"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
                />
                <View className="ml-3 bg-red-100 px-3 py-2 rounded-lg">
                  <Text className="text-red-700 text-sm">🚨 Alert</Text>
                </View>
              </View>
              <Text className="text-xs text-gray-500 mt-1">
                Show alert icon when price is older than {priceSettings.alert_days} days
              </Text>
            </View>

            {/* Enable/Disable Toggle */}
            <TouchableOpacity
              onPress={() => setPriceSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              className="flex-row items-center justify-between mb-6 p-3 bg-gray-50 rounded-lg"
            >
              <Text className="text-gray-700 font-medium">Enable Price Alerts</Text>
              <View className={`w-12 h-6 rounded-full ${
                priceSettings.enabled ? 'bg-blue-500' : 'bg-gray-300'
              }`}>
                <View className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-all ${
                  priceSettings.enabled ? 'ml-6' : 'ml-0.5'
                }`} />
              </View>
            </TouchableOpacity>

            {/* Status Indicators Preview */}
            <View className="bg-gray-50 rounded-lg p-4 mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-3">Status Indicators:</Text>
              <View className="space-y-2">
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-green-500 rounded-full mr-2" />
                  <Text className="text-sm text-gray-600">Good - Price updated within {priceSettings.warning_days} days</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-yellow-500 rounded-full mr-2" />
                  <Text className="text-sm text-gray-600">Warning - Price {priceSettings.warning_days}-{priceSettings.alert_days} days old</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-red-500 rounded-full mr-2" />
                  <Text className="text-sm text-gray-600">Alert - Price older than {priceSettings.alert_days} days</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setShowPriceAlerts(false)}
                className="flex-1 bg-gray-100 py-3 rounded-lg"
              >
                <Text className="text-center text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={savePriceSettings}
                disabled={loading}
                className="flex-1 bg-blue-500 py-3 rounded-lg flex-row items-center justify-center"
              >
                <Save size={16} color="white" />
                <Text className="text-center text-white font-medium ml-2">
                  {loading ? 'Saving...' : 'Save Settings'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
