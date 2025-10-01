import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../utils/api/supabase";
import { SafeAreaView } from "react-native-safe-area-context";
import Avatar from "../../../components/ui/Avatar.web";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/native/Card";
import Badge from "../../../components/ui/native/Badge";
import QRCode from "react-native-qrcode-svg";

interface ProfileRow {
  id: string;
  full_name: string;
  username: string | null;
  phone_number: string | null;
  status: "active" | "blocked" | "banned";
  packer_status?: "available" | "busy" | "unavailable" | string;
  avatar_url?: string | null;
  roles?: { name?: string } | null;
  current_order_id?: string | null;
}

interface RecentOrderRow {
  id: string;
  order_name: string;
  production_status: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export default function PackerProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [completedOrders, setCompletedOrders] = useState<number>(0);
  const [recentOrders, setRecentOrders] = useState<RecentOrderRow[]>([]);
  const [currentOrderName, setCurrentOrderName] = useState<string | null>(null);
  const [busySinceIso, setBusySinceIso] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const { data: p, error: e1 } = await supabase
          .from("profiles")
          .select(
            `
            id, full_name, username, phone_number, avatar_url, status, packer_status, current_order_id,
            roles:role_id ( name )
          `
          )
          .eq("id", id)
          .maybeSingle();
        if (e1) throw e1;
        setProfile(p as any);

        // Count completed orders & collect recent orders this packer was assigned to
        const { data: rows, error: e2 } = await supabase
          .from("order_team_members")
          .select(
            `
            created_at,
            order_id,
            orders:order_id!inner ( id, order_name, production_status, created_at, updated_at )
          `
          )
          .eq("packer_id", id)
          .order("created_at", { ascending: false });
        if (e2) throw e2;
        const count = (rows || []).filter(
          (r: any) => r?.orders?.production_status === "completed"
        ).length;
        setCompletedOrders(count);
        const recents: RecentOrderRow[] = (rows || [])
          .map((r: any) => ({
            id: r?.orders?.id,
            order_name: r?.orders?.order_name || "Order",
            production_status: r?.orders?.production_status || null,
            created_at: r?.orders?.created_at || r?.created_at || null,
            updated_at: r?.orders?.updated_at || null,
          }))
          .filter((o) => !!o.id)
          .slice(0, 6);
        setRecentOrders(recents);

        // If currently busy, fetch the order name and a rough "since" timestamp
        if ((p as any)?.current_order_id) {
          const { data: ord } = await supabase
            .from("orders")
            .select("id, order_name")
            .eq("id", (p as any).current_order_id)
            .maybeSingle();
          setCurrentOrderName(ord?.order_name || null);

          // Try to infer when they started being busy using active session
          const { data: session } = await supabase
            .from("packer_sessions")
            .select("created_at")
            .eq("packer_id", id)
            .eq("session_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          setBusySinceIso(session?.created_at || null);
        } else {
          setCurrentOrderName(null);
          setBusySinceIso(null);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const qrValue = useMemo(() => {
    if (!profile?.id) return "";
    // Deep-link like payload; adjust as needed
    return JSON.stringify({
      type: "packer_profile",
      id: profile.id,
      name: profile.full_name,
    });
  }, [profile?.id, profile?.full_name]);

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString();
    } catch {
      return "—";
    }
  };

  const sinceText = useMemo(() => {
    if (!busySinceIso) return null;
    try {
      const start = new Date(busySinceIso).getTime();
      const now = Date.now();
      const mins = Math.max(0, Math.floor((now - start) / 60000));
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    } catch {
      return null;
    }
  }, [busySinceIso]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-600">Loading profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <Text className="text-red-600">{error || "Profile not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const roleName = profile.roles?.name || "—";
  const statusVariant = profile.status === "active" ? "success" : "destructive";
  const packerVariant =
    profile.packer_status === "busy"
      ? "info"
      : profile.packer_status === "available"
      ? "success"
      : "outline";

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-6 py-4 h-screen">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-gray-900">
            Employee Profile
          </Text>
          <TouchableOpacity className="mr-3 rounded border border-blue-800 bg-blue-500 p-3" onPress={() => router.back()}>
            <Text className="text-white font-medium">Back</Text>
          </TouchableOpacity>
        </View>

        {/* Two-column layout */}
        <View className="flex-row gap-4 h-full">
          {/* Left: Profile details card */}
          <View className="flex-1">
            <Card className="border border-gray-400 pb-8 h-full">
              <CardContent className="py-5">
                <View className="flex-col">
                  <View className="flex justify-center items-center mb-4">
                    <Avatar
                      uri={profile.avatar_url || undefined}
                      name={profile.full_name}
                      size={300}
                    />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 pr-3">
                        <Text
                          className="text-2xl font-bold text-gray-900"
                          numberOfLines={1}
                        >
                          {profile.full_name}
                        </Text>
                        <Text className="text-gray-600 mt-1">
                          @{profile.username || "—"}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Badge variant="default">{roleName}</Badge>
                      </View>
                    </View>

                    {/* Details grid */}
                    <View className="mt-6">
                      <View className="flex-row mb-2">
                        <Text className="w-40 text-gray-500">Age</Text>
                        <Text className="text-gray-900">—</Text>
                      </View>
                      <View className="flex-row mb-2">
                        <Text className="w-40 text-gray-500">Address</Text>
                        <Text className="text-gray-900">—</Text>
                      </View>
                      <View className="flex-row mb-2">
                        <Text className="w-40 text-gray-500">Phone</Text>
                        <Text className="text-gray-900">
                          {profile.phone_number || "—"}
                        </Text>
                      </View>
                      <View className="flex-row mb-2">
                        <Text className="w-40 text-gray-500">
                          Emergency contact
                        </Text>
                        <Text className="text-gray-900">—</Text>
                      </View>
                      <View className="flex-row mb-2">
                        <Text className="w-40 text-gray-500">
                          Emergency phone
                        </Text>
                        <Text className="text-gray-900">—</Text>
                      </View>
                      <View className="flex-row mb-2">
                        <Text className="w-40 text-gray-500">
                          Role in company
                        </Text>
                        <Text className="text-gray-900">{roleName}</Text>
                      </View>
                      <View className="flex-row mb-2">
                        <Text className="w-40 text-gray-500">
                          Years in company
                        </Text>
                        <Text className="text-gray-900">—</Text>
                      </View>
                      <View className="flex-row">
                        <Text className="w-40 text-gray-500">Salary</Text>
                        <Text className="text-gray-900">—</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>

          {/* Right: Availability + QR and Recent orders */}
          <View className="flex-1">
            {/* Availability */}
            <Card className="mb-4 border border-gray-400 h-1/2">
              <CardHeader className="py-3 flex-row justify-between">
                <CardTitle>Employee Status</CardTitle>
                <View className="flex-row justify-center gap-2">
                  {profile.packer_status ? (
                    <View className="mt-2">
                      <Badge variant={packerVariant as any}>
                        {profile.packer_status}
                      </Badge>
                    </View>
                  ) : null}
                    <View className="mt-2">
                  <Badge variant={statusVariant as any}>{profile.status}</Badge>
				  </View>
                </View>
              </CardHeader>
              <CardContent>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-3">
                    <Text className="text-gray-900 text-base font-semibold">
                      {profile.packer_status
                        ? profile.packer_status.toUpperCase()
                        : "—"}
                    </Text>
                    {profile.packer_status === "busy" ? (
                      <View className="mt-2">
                        <Text className="text-gray-700">Working on</Text>
                        <Text
                          className="text-gray-900 font-medium"
                          numberOfLines={1}
                        >
                          {currentOrderName || "—"}
                        </Text>
                        <Text className="text-gray-600 mt-1">
                          {sinceText ? `since ${sinceText}` : "—"}
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-gray-600 mt-1">—</Text>
                    )}
                  </View>
                  <View className="items-center justify-center rounded-xl border border-gray-300 p-2 bg-white">
                    {qrValue ? <QRCode value={qrValue} size={200} /> : null}
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* Recent orders */}
            <Card className="border border-gray-400 h-1/2">
              <CardHeader className="py-3">
                <CardTitle>Recent orders</CardTitle>
              </CardHeader>
              <CardContent>
                {recentOrders.length === 0 ? (
                  <Text className="text-gray-600">No recent orders</Text>
                ) : (
                  <View>
                    {recentOrders.map((o) => (
                      <View
                        key={o.id}
                        className="flex-row items-center py-2 border-b border-gray-100 last:border-b-0"
                      >
                        <Text
                          className="flex-1 text-gray-900"
                          numberOfLines={1}
                        >
                          {o.order_name}
                        </Text>
                        <Text
                          className="w-40 text-gray-600 text-sm"
                          numberOfLines={1}
                        >
                          {formatDate(o.created_at)} -{" "}
                          {formatDate(o.updated_at)}
                        </Text>
                        <Text className="w-24 text-gray-800 font-medium capitalize text-right">
                          {o.production_status || "—"}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </CardContent>
            </Card>

            {/* Small stat for completed orders */}
            {/* <Card className="mt-4">
              <CardContent className="py-3">
                <Text className="text-sm text-gray-600">Orders completed</Text>
                <Text className="text-2xl font-bold text-gray-900">
                  {completedOrders}
                </Text>
              </CardContent>
            </Card> */}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
