import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings2, Database, Notifications, Shield } from 'lucide-react-native';

export default function SettingsPage() {
  const settingsSections = [
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
      icon: Notifications,
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
    </SafeAreaView>
  );
}
