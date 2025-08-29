import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { usePackerSession } from '../../utils/PackerSessionContext';
import { db } from '../../utils/api/supabase';
import { teamLead } from '../../utils/api/teamLead';
import { NavigationButtons } from '../../components/NavigationButtons';
import { SuccessAlert, ErrorAlert } from '../../components/ui/Alert';

interface Order {
  id: string;
  order_name: string;
  description: string;
  client_name: string;
  production_status: string;
  assigned_packers_count: number;
}

interface Packer {
  id: string;
  full_name: string;
  username: string;
  packer_status: string;
  current_order_name?: string;
  is_available: boolean;
}

export default function PackerDashboard() {
  const { profile, signOut } = useAuth();
  const { createSession, session } = usePackerSession();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isCompact = isLandscape && height < 450;
  const isPortraitPhone = !isLandscape && width < 480; // stack header info and smaller sizes
  const isPortraitStack = !isLandscape && width < 600; // stack columns on narrow portrait
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [allPackers, setAllPackers] = useState<Packer[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedPackers, setSelectedPackers] = useState<string[]>([]);
  const [projectLead, setProjectLead] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [successAlert, setSuccessAlert] = useState<{visible: boolean, title: string, message?: string}>({visible: false, title: ''});
  const [errorAlert, setErrorAlert] = useState<{visible: boolean, title: string, message?: string}>({visible: false, title: ''});

  useEffect(() => {
    loadData();
  }, []);

  // Check for existing session and restore state
  useEffect(() => {
    if (session && session.order_id) {
      // User has an active session, restore their previous selections
      restoreSessionState();
    }
  }, [session]);

  const restoreSessionState = async () => {
    if (!session || !session.order_id) return;
    
    try {
      // Set the selected order from session
      setSelectedOrder(session.order_id);
      
      // Load the packers assigned to this order
      const { data: orderPackers, error } = await db.getOrderPackers(session.order_id);
      if (error) {
        console.error('Error loading session packers:', error);
        return;
      }
      
      // Set selected packers from the order
      if (orderPackers && orderPackers.length > 0) {
        const packerIds = orderPackers.map(p => p.packer_id || p.id);
        setSelectedPackers(packerIds);
        
        // Find project lead if exists
        const leadPacker = orderPackers.find(p => p.is_project_lead);
        if (leadPacker) {
          setProjectLead(leadPacker.packer_id || leadPacker.id);
        }
      }
      
      console.log('Session state restored for order:', session.order_id);
    } catch (error) {
      console.error('Error restoring session state:', error);
    }
  };

  const loadData = async () => {
    try {
      // Load available orders
      const { data: orders, error: ordersError } = await db.getAvailableOrders();
      if (ordersError) {
        console.error('Error loading orders:', ordersError);
      } else {
        setAvailableOrders(orders || []);
      }

      // Load all packers with their current assignment status
      const { data: packersData, error: packersError } = await db.getAllPackersWithStatus();
      if (packersError) {
        console.error('Error loading packers:', packersError);
      } else {
        // Transform the data to include availability
        const transformedPackers = (packersData || []).map(packer => ({
          id: packer.id,
          full_name: packer.full_name,
          username: packer.username,
          packer_status: packer.packer_status,
          current_order_name: packer.current_order_name || null,
          is_available: packer.packer_status === 'available'
        }));
        setAllPackers(transformedPackers);
        
        // Auto-select the logged-in user if they're available
        if (profile?.id) {
          const currentUser = transformedPackers.find(packer => packer.id === profile.id);
          if (currentUser && currentUser.is_available) {
            setSelectedPackers(prev => {
              if (!prev.includes(profile.id)) {
                return [...prev, profile.id];
              }
              return prev;
            });
            console.log('Auto-selected current user:', currentUser.full_name);
          }
        }
      }
    } catch (error) {
      console.error('Error in loadData:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePackerSelection = (packerId: string) => {
    // Only allow selection of available packers
    const packer = allPackers.find(p => p.id === packerId);
    if (!packer?.is_available) return;
    
    setSelectedPackers(prev => {
      const isCurrentlySelected = prev.includes(packerId);
      
      if (isCurrentlySelected) {
        // If deselecting this packer and they're the project lead, clear project lead
        if (projectLead === packerId) {
          setProjectLead(null);
        }
        return prev.filter(id => id !== packerId);
      } else {
        return [...prev, packerId];
      }
    });
  };

  const toggleProjectLead = (packerId: string) => {
    // Only allow project lead selection from selected packers
    if (!selectedPackers.includes(packerId)) return;
    
    // Only one project lead can be selected
    setProjectLead(prev => prev === packerId ? null : packerId);
  };

  const handleNext = async () => {
    if (!selectedOrder) {
      setErrorAlert({visible: true, title: 'Project Required', message: 'Please select a project'});
      return;
    }

    if (selectedPackers.length === 0) {
      setErrorAlert({visible: true, title: 'Team Required', message: 'Please select at least one packer'});
      return;
    }

    if (!projectLead) {
      setErrorAlert({visible: true, title: 'Project Lead Required', message: 'Please select a project lead from the team members'});
      return;
    }

    try {
      // Assign packers to order
      const { error: assignError } = await db.assignPackersToOrder(selectedOrder, selectedPackers);
      
      if (assignError) {
        setErrorAlert({visible: true, title: 'Assignment Failed', message: 'Failed to assign team to project'});
        return;
      }

      // Assign team lead using the new temporary role system
      if (projectLead) {
        const { error: teamLeadError } = await teamLead.assignTeamLead(selectedOrder, projectLead);
        if (teamLeadError) {
          console.error('Error assigning team lead:', teamLeadError);
          // Don't block navigation for this error, just log it
        } else {
          console.log('Team lead assigned successfully:', projectLead);
          // Also update order.project_lead_id and ensure status is in_progress
          const { error: updateLeadError } = await db.updateProjectLead(selectedOrder, projectLead);
          if (updateLeadError) {
            console.warn('Project lead update (orders table) failed:', updateLeadError);
          } else {
            console.log('Order updated with project lead and status set to in_progress (if pending).');
          }
        }
      }

      // Get order details for session creation
      const { data: orderData, error: orderError } = await db.getOrderById(selectedOrder);
      if (orderError || !orderData) {
        console.error('Error getting order details:', orderError);
        setErrorAlert({visible: true, title: 'Project Error', message: 'Failed to get project details'});
        return;
      }

      // Create sessions for all selected packers (team-based sessions)
      const { data: teamSessions, error: sessionError } = await db.createTeamSessions(selectedOrder, orderData, selectedPackers);
      if (sessionError || !teamSessions) {
        console.error('Failed to create team sessions:', sessionError);
        setErrorAlert({visible: true, title: 'Session Warning', message: 'Failed to create team sessions, but you can continue'});
        // Don't block navigation if session creation fails
      } else {
        console.log(`Created ${teamSessions.length} team sessions for selected packers`);
        setSuccessAlert({visible: true, title: 'Team Assigned Successfully', message: `Created sessions for ${teamSessions.length} team members`});
        
        // Update the current user's session in context if they're part of the selected team
        if (profile?.id && selectedPackers.includes(profile.id)) {
          const userSession = teamSessions.find(s => s.packer_id === profile.id);
          if (userSession && createSession) {
            // Update the session context with the user's session
            await createSession(selectedOrder, orderData);
          }
        }
      }

      // Navigate to attendance screen
      router.push({
        pathname: '/(packer)/attendance',
        params: { 
          orderId: selectedOrder
        }
      });
    } catch (error) {
      console.error('Error assigning team:', error);
      setErrorAlert({visible: true, title: 'Unexpected Error', message: 'An unexpected error occurred'});
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out error:', error);
        setErrorAlert({visible: true, title: 'Sign Out Failed', message: 'Failed to sign out'});
      } else {
        // Force navigation to login after successful sign out
        router.replace('/auth/login');
      }
    } catch (error) {
      console.error('Unexpected sign out error:', error);
      setErrorAlert({visible: true, title: 'Sign Out Error', message: 'An unexpected error occurred during sign out'});
    }
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={['top','bottom','left','right']}>
        <View className="flex-1 justify-center items-center">
          <Text className="text-lg text-gray-600">Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top','bottom','left','right']}>
      {/* Header */}
      <View className={`bg-primary-500 ${isCompact ? 'px-3 py-2' : 'px-4 py-3'}`}>
        {isPortraitPhone ? (
          <View className="space-y-1">
            <View className="flex-row justify-between items-center">
              <Text className="text-white text-lg font-bold">Files to be processed</Text>
              <TouchableOpacity 
                onPress={handleSignOut}
                className="px-2 py-1 bg-primary-600 rounded"
              >
                <Text className="text-white text-xs">Sign Out</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row justify-between items-center mt-1">
              <Text className="text-primary-100 text-xs">Welcome, {profile?.full_name}</Text>
              <Text className="text-white text-xs font-medium">{getCurrentTime()}</Text>
            </View>
          </View>
        ) : (
          <View className="flex-row justify-between items-center">
            <View>
              <Text className={`${isCompact ? 'text-lg' : 'text-xl'} text-white font-bold`}>
                Files to be processed
              </Text>
              <Text className="text-primary-100 text-xs">
                Welcome, {profile?.full_name}
              </Text>
            </View>
            <View className="flex-row items-center space-x-3">
              <Text className={`text-white text-xs font-medium ${isCompact ? 'me-2' : ''}`}>
                {getCurrentTime()}
              </Text>
              <TouchableOpacity 
                onPress={handleSignOut}
                className={`${isCompact ? 'px-2 py-1' : 'px-3 py-1'} bg-primary-600 rounded`}
              >
                <Text className="text-white text-xs">Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Navigation Buttons */}
      <NavigationButtons currentScreen="dashboard" />

      {/* Alert Messages */}
      <SuccessAlert
        visible={successAlert.visible}
        title={successAlert.title}
        message={successAlert.message}
        onClose={() => setSuccessAlert({visible: false, title: ''})}
        autoDismiss={true}
      />
      <ErrorAlert
        visible={errorAlert.visible}
        title={errorAlert.title}
        message={errorAlert.message}
        onClose={() => setErrorAlert({visible: false, title: ''})}
        autoDismiss={true}
      />

      {/* Main Content */}
      <View className={`flex-1 ${isCompact ? 'p-3' : 'p-4'}`}>
        <View className={`${isPortraitStack ? 'flex-col gap-y-3' : (isCompact ? 'flex-row gap-x-3' : 'flex-row gap-x-4')} flex-1`}>
          {/* Left Column - Select File */}
          <View className="flex-1 bg-white rounded-lg shadow-sm">
            <View className={`bg-primary-500 ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} rounded-t-lg`}>
              <Text className={`${isCompact ? 'text-sm' : 'text-base'} text-white font-semibold`}>
                Select File
              </Text>
            </View>
            
            <ScrollView className={`flex-1 ${isCompact ? 'p-3' : 'p-4'}`}>
{availableOrders.length === 0 ? (
                <Text className="text-gray-500 text-center py-6">
                  No projects available
                </Text>
              ) : (
                availableOrders.map((order) => (
                  <TouchableOpacity
                    key={order.id}
                    onPress={() => order.production_status !== 'in_progress' ? setSelectedOrder(order.id) : null}
                    className={`mb-2 ${isCompact ? 'p-2' : 'p-3'} rounded-lg border ${
                      selectedOrder === order.id
                        ? 'bg-primary-50 border-primary-500'
                        : order.production_status === 'in_progress'
                        ? 'bg-gray-100 border-gray-300 opacity-50'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                    disabled={order.production_status === 'in_progress'}
                  >
                    <View className="flex-row items-center">
                      <View className={`w-4 h-4 rounded mr-3 ${
                        selectedOrder === order.id ? 'bg-primary-500' : 'bg-gray-300'
                      }`} />
                      <View className="flex-1">
                        <Text className={`font-medium ${
                          selectedOrder === order.id ? 'text-primary-700' : 'text-gray-900'
                        }`}>
                          📄 {order.order_name}
                        </Text>
                        <Text className="text-gray-600 text-xs mt-1">
                          {order.client_name}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>

          {/* Right Column - Select Packers */}
          <View className="flex-1 bg-white rounded-lg shadow-sm">
            <View className={`bg-primary-500 ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} rounded-t-lg`}>
              <Text className={`${isCompact ? 'text-sm' : 'text-base'} text-white font-semibold`}>
                Select Packers
              </Text>
            </View>
            
            <View className={`${isCompact ? 'p-3' : 'p-4'}`}>
              <View className={`flex-row justify-between items-center ${isCompact ? 'mb-2' : 'mb-4'}`}>
                <Text className={`${isCompact ? 'text-sm' : 'text-base'} text-gray-700 font-medium`}>Packer Name</Text>
                <Text className={`${isCompact ? 'text-sm' : 'text-base'} text-gray-700 font-medium`}>Project Lead</Text>
              </View>
            </View>

            <ScrollView className={`${isCompact ? 'px-3' : 'px-4'} flex-1`}>
              {allPackers.length === 0 ? (
                <Text className="text-gray-500 text-center py-6">
                  No packers found
                </Text>
              ) : (
                allPackers.map((packer) => {
                  const isSelected = selectedPackers.includes(packer.id);
                  const isProjectLead = projectLead === packer.id;
                  const canBeProjectLead = isSelected && packer.is_available;

                  const cardCls = `${isCompact ? 'p-2' : 'p-3'} mb-2 rounded-lg border flex-row items-center justify-between ${
                    isSelected
                      ? 'bg-primary-50 border-primary-500'
                      : !packer.is_available
                      ? 'bg-gray-100 border-gray-300 opacity-50'
                      : 'bg-gray-50 border-gray-200'
                  }`;
                  
                  return (
                    <TouchableOpacity
                      key={packer.id}
                      onPress={() => packer.is_available && togglePackerSelection(packer.id)}
                      activeOpacity={packer.is_available ? 0.7 : 1}
                      disabled={!packer.is_available}
                      className={cardCls}
                    >
                      <View className="flex-row items-center flex-1">
                        <View className={`w-4 h-4 rounded mr-3 ${
                          isSelected
                            ? 'bg-primary-500'
                            : packer.is_available
                            ? 'bg-gray-300'
                            : 'bg-gray-200'
                        }`} />
                        <View className="flex-1">
                          <Text className={`font-medium ${
                            isSelected ? 'text-primary-700' : (packer.is_available ? 'text-gray-900' : 'text-gray-400')
                          }`}>
                            {packer.full_name}
                          </Text>
                          {!packer.is_available && packer.current_order_name && (
                            <Text className="text-[11px] text-gray-400 mt-0.5">
                              Working on: {packer.current_order_name}
                            </Text>
                          )}
                          {!packer.is_available && !packer.current_order_name && (
                            <Text className="text-[11px] text-gray-400 mt-0.5">
                              Status: {packer.packer_status}
                            </Text>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity 
                        onPress={() => toggleProjectLead(packer.id)}
                        activeOpacity={canBeProjectLead ? 0.7 : 1}
                        disabled={!canBeProjectLead}
                      >
                        <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                          isProjectLead
                            ? 'bg-primary-500 border-primary-500'
                            : canBeProjectLead
                            ? 'border-gray-300'
                            : 'border-gray-200 bg-gray-100'
                        }`}>
                          {isProjectLead && (
                            <Text className="text-white text-xs">✓</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>

        {/* Next Button - Only show if no active session */}
        {!session && (
          <View className={`${isCompact ? 'mt-3' : 'mt-4'} flex-row justify-end`}>
            <TouchableOpacity
              onPress={handleNext}
              disabled={!selectedOrder || selectedPackers.length === 0}
              className={`${isCompact ? 'px-4 py-2' : 'px-6 py-3'} rounded-lg ${
                selectedOrder && selectedPackers.length > 0
                  ? 'bg-primary-500'
                  : 'bg-gray-300'
              }`}
            >
              <Text className={`font-semibold ${
                selectedOrder && selectedPackers.length > 0
                  ? 'text-white'
                  : 'text-gray-500'
              }`}>
                ▷ Next
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Session Active Message */}
        {session && (
          <View className={`${isCompact ? 'mt-3 p-3' : 'mt-4 p-4'} bg-blue-50 border border-blue-200 rounded-lg`}>
            <Text className="text-blue-800 font-medium text-center">
              ✓ Team session active for: {session.order_name}
            </Text>
            <Text className="text-blue-600 text-xs md:text-sm text-center mt-1">
              Use navigation buttons above to continue your work
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
