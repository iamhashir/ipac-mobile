import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Users, Briefcase, CheckCircle2 } from 'lucide-react-native';
import { db } from '../../../utils/api/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import Badge from '../../ui/Badge';
import { useRouter } from 'expo-router';

interface PackerRow {
  id: string;
  full_name: string;
  username: string | null;
  packer_status: 'available' | 'busy' | 'unavailable' | string;
  current_order_id: string | null;
  current_order_name: string | null;
}

const StatCard = ({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: React.ComponentType<any>; color: string }) => (
  <View className="flex-1 mx-1">
    <Card>
      <CardContent className="py-4">
        <View className="flex-row items-center justify-between">
          <View className={`p-2 rounded-lg ${color}`}>
            <Icon size={20} color="white" />
          </View>
          <Text className="text-2xl font-bold text-gray-900">{value}</Text>
        </View>
        <Text className="text-sm text-gray-600 mt-1">{title}</Text>
      </CardContent>
    </Card>
  </View>
);

export default function PackerStatsHeader() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packers, setPackers] = useState<PackerRow[]>([]);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await db.getAllPackersWithStatus();
      if (error) {
        setError('Failed to load packer stats');
      }
      setPackers((data as any) || []);
      setLoading(false);
    };
    load();
  }, []);

  const total = packers.length;
  const working = packers.filter(p => p.packer_status === 'busy').length;
  const available = packers.filter(p => p.packer_status === 'available').length;
  const busyPackers = packers.filter(p => p.packer_status === 'busy');

  return (
    <View className="mt-4">
      <View className="flex-row mb-3">
        <StatCard title="Total Packers" value={loading ? '…' : total} icon={Users} color="bg-gray-600" />
        <StatCard title="Working Now" value={loading ? '…' : working} icon={Briefcase} color="bg-blue-600" />
        <StatCard title="Available" value={loading ? '…' : available} icon={CheckCircle2} color="bg-green-600" />
      </View>

      <Card>
        <CardHeader className="py-3">
          <CardTitle>Who is working on which order</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <Text className="text-red-600">{error}</Text>
          ) : loading ? (
            <Text className="text-gray-600">Loading…</Text>
          ) : busyPackers.length === 0 ? (
            <Text className="text-gray-600">No one is currently working.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2">
              <View className="flex-row px-2 py-1">
                {busyPackers.map((p) => (
                  <View key={p.id} className="mr-3 p-3 rounded-lg border border-gray-200 bg-white min-w-[220px]">
                    <Text className="text-gray-900 font-semibold" numberOfLines={1}>{p.full_name}</Text>
                    <View className="flex-row items-center mt-1">
                      <Badge variant="info">{p.current_order_name || 'Unknown Order'}</Badge>
                    </View>
                    <View className="flex-row mt-2">
                      <TouchableOpacity
                        onPress={() => router.push(`/(admin)/users/${p.id}`)}
                        className="bg-blue-50 border border-blue-600 px-3 py-1 rounded"
                      >
                        <Text className="text-blue-700 text-sm font-semibold">View Profile</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </CardContent>
      </Card>
    </View>
  );
}