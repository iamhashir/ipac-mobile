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
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ActiveTaskSummary, buildActiveTaskSummaries, formatBoxList, formatPackerList } from '../../utils/tasks/activeTaskSummaries';

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
  current_order_name?: string | null;
  is_available: boolean;
}

interface OrderPackerAssignment {
  id?: string | null;
  packer_id?: string | null;
  is_team_lead?: boolean | null;
  is_project_lead?: boolean | null;
}

const normalizeOrderPackers = (packers: unknown): OrderPackerAssignment[] =>
  Array.isArray(packers) ? (packers as OrderPackerAssignment[]) : [];

const resolvePackerIdentifier = (packer?: OrderPackerAssignment | null): string | null =>
  packer?.packer_id || packer?.id || null;

const collectPackerIds = (packers: OrderPackerAssignment[]): string[] =>
  packers
    .map(resolvePackerIdentifier)
    .filter((id): id is string => Boolean(id));

export default function PackerDashboard() {
  const { profile, signOut } = useAuth();
  const { createSession, session, clearSession } = usePackerSession();
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
  const [projectLeads, setProjectLeads] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [successAlert, setSuccessAlert] = useState<{visible: boolean, title: string, message?: string}>({visible: false, title: ''});
  const [errorAlert, setErrorAlert] = useState<{visible: boolean, title: string, message?: string}>({visible: false, title: ''});
  const [releaseModalVisible, setReleaseModalVisible] = useState(false);
  const [releaseModalLoading, setReleaseModalLoading] = useState(false);
  const [releaseSummary, setReleaseSummary] = useState<ActiveTaskSummary[]>([]);
  const [releaseTargets, setReleaseTargets] = useState<string[]>([]);

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

  // Load team leads when order is selected and check if current user is a lead
  useEffect(() => {
    const loadOrderTeamLeads = async () => {
      if (!selectedOrder || !profile?.id) return;
      
      try {
        // Use the new getOrderTeamLeads function
        const { data: teamLeadsData, error } = await teamLead.getOrderTeamLeads(selectedOrder);
        
        if (error) {
          console.error('Error loading team leads:', error);
          return;
        }
        
        if (teamLeadsData && teamLeadsData.length > 0) {
          const leadIds = teamLeadsData.map((lead: any) => lead.packer_id);
          setProjectLeads(leadIds);
          
          // Check if current user is a team lead for this order
          const userIsLead = leadIds.includes(profile.id);
          setIsTeamLead(userIsLead);
          
          console.log('Loaded existing team leads for order:', leadIds);
          console.log('Current user is team lead:', userIsLead);
        } else {
          setIsTeamLead(false);
        }
      } catch (error) {
        console.error('Error loading team leads:', error);
      }
    };
    
    loadOrderTeamLeads();
  }, [selectedOrder, profile?.id]);

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
      const normalizedPackers = normalizeOrderPackers(orderPackers);
      if (normalizedPackers.length > 0) {
        const packerIds = collectPackerIds(normalizedPackers);
        if (packerIds.length > 0) {
          setSelectedPackers(packerIds);
        }

        // Find all project leads
        const leadPackers = normalizedPackers.filter(p => p.is_team_lead || p.is_project_lead);
        if (leadPackers.length > 0) {
          const leadIds = collectPackerIds(leadPackers);
          if (leadIds.length > 0) {
            setProjectLeads(leadIds);
            console.log('Restored project leads:', leadIds);
          }
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
        const currentUserId = profile?.id;
        if (currentUserId) {
          const currentUser = transformedPackers.find(packer => packer.id === currentUserId);
          if (currentUser && currentUser.is_available) {
            setSelectedPackers(prev => (prev.includes(currentUserId) ? prev : [...prev, currentUserId]));
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

  const resetReleaseModalState = () => {
    setReleaseTargets([]);
    setReleaseSummary([]);
    setReleaseModalVisible(false);
  };

  const prepareReleaseModal = async () => {
    if (!selectedOrder) {
      return;
    }

    try {
      setReleaseModalLoading(true);
      const { data: orderPackers, error } = await db.getOrderPackers(selectedOrder);
      if (error) {
        console.error('Error loading team before release:', error);
        setErrorAlert({ visible: true, title: 'Release Failed', message: 'Unable to load current team for this project' });
        setReleaseTargets([]);
        return;
      }

      const normalizedPackers = normalizeOrderPackers(orderPackers);
      const targetIds = collectPackerIds(normalizedPackers);

      if (targetIds.length === 0) {
        setErrorAlert({ visible: true, title: 'Nothing to Release', message: 'There are no packers assigned to this project.' });
        setReleaseTargets([]);
        return;
      }

      const nameLookup: Record<string, string> = {};
      normalizedPackers.forEach((packer) => {
        const id = resolvePackerIdentifier(packer);
        if (!id) return;
        const fallbackName = allPackers.find((p) => p.id === id)?.full_name;
        nameLookup[id] = (packer as any)?.full_name || (packer as any)?.profiles?.full_name || fallbackName || 'Unknown';
      });

      setReleaseTargets(targetIds);

      const { data: tasksData, error: tasksError } = await db.getActiveTasksForPackers(selectedOrder, targetIds);
      if (tasksError) {
        console.warn('Error loading active tasks before release:', tasksError);
        setReleaseSummary([]);
      } else {
        setReleaseSummary(buildActiveTaskSummaries(tasksData || [], nameLookup));
      }

      setReleaseModalVisible(true);
    } catch (error) {
      console.error('Error preparing release confirmation:', error);
      setErrorAlert({ visible: true, title: 'Release Failed', message: 'Unexpected error preparing release confirmation' });
      setReleaseTargets([]);
    } finally {
      setReleaseModalLoading(false);
    }
  };

  const handleReleaseOrder = async () => {
    if (!selectedOrder || releaseTargets.length === 0) {
      resetReleaseModalState();
      return;
    }

    try {
      setReleaseModalLoading(true);
      await db.completeAssignmentsForPackers(selectedOrder, releaseTargets);

      const { error: attendanceCleanupError } = await db.endAttendanceForPackers(selectedOrder, releaseTargets);
      if (attendanceCleanupError) {
        console.warn('⚠️ Failed to close attendance logs during release:', attendanceCleanupError);
      }

      for (const packerId of releaseTargets) {
        const { error } = await db.removePackerFromOrder(selectedOrder, packerId);
        if (error) {
          throw error;
        }
      }

      await teamLead.removeAllTeamLeads(selectedOrder);
      setProjectLeads([]);
      setIsTeamLead(false);

      const { error: statusError } = await db.setOrderProductionStatus(selectedOrder, 'on_hold');
      if (statusError) {
        console.warn('⚠️ Failed to update order status to on_hold:', statusError);
      }

      if (profile?.id && releaseTargets.includes(profile.id)) {
        clearSession();
      }

      setSuccessAlert({ visible: true, title: 'Project Released', message: 'Team removed and project unlocked for others.' });
      setSelectedOrder(null);
      setSelectedPackers([]);
      resetReleaseModalState();
      await loadData();
    } catch (error) {
      console.error('Error releasing project:', error);
      setErrorAlert({ visible: true, title: 'Release Failed', message: 'Could not release this project.' });
    } finally {
      setReleaseModalLoading(false);
    }
  };

  const handleCloseReleaseModal = () => {
    if (releaseModalLoading) return;
    resetReleaseModalState();
  };

  const togglePackerSelection = (packerId: string) => {
    const packer = allPackers.find(p => p.id === packerId);
    const isCurrentlySelected = selectedPackers.includes(packerId);
    const isActiveSession = session && session.order_id === selectedOrder;
    
    // For orders with existing team: only allow team leads to modify selection
    if (isActiveSession && !isTeamLead) {
      setErrorAlert({visible: true, title: 'Permission Denied', message: 'Only team leads can modify team membership'});
      return;
    }
    
    if (isCurrentlySelected) {
      // Deselecting a packer (removing from team)
      // Check if this is a team lead trying to remove themselves
      if (packerId === profile?.id && projectLeads.includes(packerId)) {
        // Check if there are other team leads
        const otherLeads = projectLeads.filter(id => id !== packerId);
        if (otherLeads.length === 0) {
          setErrorAlert({visible: true, title: 'Cannot Remove', message: 'You are the last team lead. Please assign another team lead before removing yourself.'});
          return;
        }
      }
      
      // Update local state only - will save when Update button is clicked
      if (projectLeads.includes(packerId)) {
        setProjectLeads(prevLeads => prevLeads.filter(id => id !== packerId));
      }
      setSelectedPackers(prev => prev.filter(id => id !== packerId));
    } else {
      // Selecting a packer (adding to team)
      if (!packer?.is_available) {
        setErrorAlert({visible: true, title: 'Packer Unavailable', message: `${packer?.full_name || 'This packer'} is currently unavailable`});
        return;
      }
      
      // Update local state only - will save when Update button is clicked
      setSelectedPackers(prev => [...prev, packerId]);
    }
  };

  const toggleProjectLead = (packerId: string) => {
    // Only allow project lead selection from selected packers
    if (!selectedPackers.includes(packerId)) {
      setErrorAlert({visible: true, title: 'Cannot Assign', message: 'Please select this packer as a team member first'});
      return;
    }
    
    const isActiveSession = session && session.order_id === selectedOrder;
    
    // For orders with existing team: only allow team leads to modify lead assignments
    if (isActiveSession && !isTeamLead) {
      setErrorAlert({visible: true, title: 'Permission Denied', message: 'Only team leads can assign team lead roles'});
      return;
    }
    
    // Toggle this packer as a project lead (supports multiple leads)
    setProjectLeads(prev => {
      if (prev.includes(packerId)) {
        // Removing lead status - check if this is the last lead
        if (prev.length === 1) {
          setErrorAlert({visible: true, title: 'Cannot Remove', message: 'At least one team lead is required. Please assign another team lead first.'});
          return prev;
        }
        // Remove from leads
        return prev.filter(id => id !== packerId);
      } else {
        // Add to leads
        return [...prev, packerId];
      }
    });
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

    if (projectLeads.length === 0) {
      setErrorAlert({visible: true, title: 'Project Lead Required', message: 'Please select at least one project lead from the team members'});
      return;
    }

    const isActiveSession = session && session.order_id === selectedOrder;

    try {
      // Get order details first
      const { data: orderData, error: orderError } = await db.getOrderById(selectedOrder);
      if (orderError || !orderData) {
        console.error('Error getting order details:', orderError);
        setErrorAlert({visible: true, title: 'Project Error', message: 'Failed to get project details'});
        return;
      }

      if (isActiveSession) {
        // For active sessions, handle additions and removals
  const { data: currentPackers } = await db.getOrderPackers(selectedOrder);
  const currentPackerList = normalizeOrderPackers(currentPackers);
  const currentPackerIds = collectPackerIds(currentPackerList);
        
        // Find packers to add
        const packersToAdd = selectedPackers.filter(id => !currentPackerIds.includes(id));
        
        // Find packers to remove
        const packersToRemove = currentPackerIds.filter(id => !selectedPackers.includes(id));
        
        if (packersToRemove.length > 0) {
          const { error: removalTaskError } = await db.completeAssignmentsForPackers(selectedOrder, packersToRemove);
          if (removalTaskError) {
            console.warn('⚠️ Failed to complete tasks before removing packers:', removalTaskError);
          }

          const { error: removalAttendanceError } = await db.endAttendanceForPackers(selectedOrder, packersToRemove);
          if (removalAttendanceError) {
            console.warn('⚠️ Failed to close attendance logs before removing packers:', removalAttendanceError);
          }
        }

        // Remove packers
        let removedSelf = false;
        for (const packerId of packersToRemove) {
          const { error } = await db.removePackerFromOrder(selectedOrder, packerId);
          if (error) {
            console.error('Error removing packer:', packerId, error);
          } else if (packerId === profile?.id) {
            removedSelf = true;
          }
        }

        if (removedSelf) {
          clearSession();
          setSelectedOrder(null);
        }
        
        // Add packers
        for (const packerId of packersToAdd) {
          const { error } = await db.addPackerToOrder(selectedOrder, packerId, orderData);
          if (error) {
            console.error('Error adding packer:', packerId, error);
          }
        }
        
        // Update team leads
        await teamLead.removeAllTeamLeads(selectedOrder);
        for (const leadId of projectLeads) {
          await teamLead.addTeamLead(selectedOrder, leadId);
        }
        
        // Update order.project_lead_id
        await db.updateProjectLead(selectedOrder, projectLeads[0]);
        
        setSuccessAlert({visible: true, title: 'Team Updated', message: 'Team changes saved successfully'});
        
        // Force complete reload with a small delay to allow database to update
        setTimeout(async () => {
          await loadData();
          // Reload the order team leads to get fresh state
          const { data: teamLeadsData } = await teamLead.getOrderTeamLeads(selectedOrder);
          if (teamLeadsData && teamLeadsData.length > 0) {
            const leadIds = teamLeadsData.map((lead: any) => lead.packer_id);
            setProjectLeads(leadIds);
            setIsTeamLead(leadIds.includes(profile?.id || ''));
          }
        }, 500);
      } else {
        // New assignment - original flow
        // Assign packers to order
        const { error: assignError } = await db.assignPackersToOrder(selectedOrder, selectedPackers);
        
        if (assignError) {
          setErrorAlert({visible: true, title: 'Assignment Failed', message: 'Failed to assign team to project'});
          return;
        }

        // Assign team leads using the new multi-lead system
        if (projectLeads.length > 0) {
          // Clear existing leads first for clean assignment
          await teamLead.removeAllTeamLeads(selectedOrder);
          
          // Add each selected lead
          for (const leadId of projectLeads) {
            const { error: teamLeadError } = await teamLead.addTeamLead(selectedOrder, leadId);
            if (teamLeadError) {
              console.error('Error assigning team lead:', leadId, teamLeadError);
            } else {
              console.log('Team lead assigned successfully:', leadId);
            }
          }
          
          // Update order.project_lead_id with the first lead (for backward compatibility)
          const { error: updateLeadError } = await db.updateProjectLead(selectedOrder, projectLeads[0]);
          if (updateLeadError) {
            console.warn('Project lead update (orders table) failed:', updateLeadError);
          } else {
            console.log('Order updated with project lead and status set to in_progress (if pending).');
          }
        }

        // Create sessions for all selected packers (team-based sessions)
        const { data: teamSessions, error: sessionError } = await db.createTeamSessions(selectedOrder, orderData, selectedPackers);
        if (sessionError || !teamSessions) {
          console.error('Failed to create team sessions:', sessionError);
          setErrorAlert({visible: true, title: 'Session Warning', message: 'Failed to create team sessions, but you can continue'});
        } else {
          console.log(`Created ${teamSessions.length} team sessions for selected packers`);
          setSuccessAlert({visible: true, title: 'Team Assigned Successfully', message: `Created sessions for ${teamSessions.length} team members`});
          
          // Update the current user's session in context if they're part of the selected team
          if (profile?.id && selectedPackers.includes(profile.id)) {
            type TeamSession = { packer_id?: string | null };
            const normalizedSessions: TeamSession[] = Array.isArray(teamSessions) ? (teamSessions as TeamSession[]) : [];
            const userSession = normalizedSessions.find((session) => session.packer_id === profile.id);
            if (userSession && createSession) {
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
      }
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

  const isOnlySelfOnTeam = profile?.id ? (selectedPackers.length === 1 && selectedPackers[0] === profile.id) : false;
  const canReleaseOrder = Boolean(
    selectedOrder &&
    session?.order_id === selectedOrder &&
    profile?.id &&
    selectedPackers.includes(profile.id) &&
    (isTeamLead || isOnlySelfOnTeam)
  );

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

      <ConfirmModal
        visible={releaseModalVisible}
        title="Release Project"
        description="Removing the team will mark these in-progress tasks as completed and unlock the project for others."
        confirmText={releaseModalLoading ? 'Releasing...' : 'Release'}
        cancelText="Cancel"
        variant="danger"
        loading={releaseModalLoading}
        onConfirm={handleReleaseOrder}
        onCancel={handleCloseReleaseModal}
      >
        {releaseSummary.length === 0 ? (
          <Text className="text-gray-700">No active tasks will be updated.</Text>
        ) : (
          releaseSummary.map((item, index) => (
            <View key={`${item.task}-${index}`} className="mb-3 p-2 bg-gray-50 rounded">
              <Text className="text-gray-900 font-semibold">{item.task}</Text>
              <Text className="text-gray-700 text-sm mt-1">
                <Text className="font-medium">Packers:</Text> {formatPackerList(item.packerNames)}
              </Text>
              <Text className="text-gray-700 text-sm">
                <Text className="font-medium">Boxes:</Text> {formatBoxList(item.boxes)}
              </Text>
            </View>
          ))
        )}
      </ConfirmModal>

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
                availableOrders.map((order) => {
                  const hasActiveSession = !!session?.order_id;
                  const isUsersActiveOrder = hasActiveSession && session?.order_id === order.id;
                  const isLockedBySession = hasActiveSession && !isUsersActiveOrder; // user already working on another order
                  const isGloballyLocked = order.production_status === 'in_progress' && !isUsersActiveOrder;
                  const isDisabled = isLockedBySession || isGloballyLocked;
                  const isOnHold = order.production_status === 'on_hold';
                  const isSelected = selectedOrder === order.id;
                  const cardStateClass = isSelected
                    ? 'bg-primary-50 border-primary-500'
                    : isDisabled
                    ? 'bg-gray-100 border-gray-300 opacity-50'
                    : isOnHold
                    ? 'bg-indigo-50 border-indigo-200'
                    : 'bg-gray-50 border-gray-200';

                  return (
                    <TouchableOpacity
                      key={order.id}
                      onPress={() => !isDisabled ? setSelectedOrder(order.id) : null}
                      className={`mb-2 ${isCompact ? 'p-2' : 'p-3'} rounded-lg border ${cardStateClass}`}
                      disabled={isDisabled}
                    >
                      <View className="flex-row items-center">
                        <View className={`w-4 h-4 rounded mr-3 ${
                          isSelected ? 'bg-primary-500' : 'bg-gray-300'
                        }`} />
                        <View className="flex-1">
                          <Text className={`font-medium ${
                            isSelected ? 'text-primary-700' : 'text-gray-900'
                          }`}>
                            📄 {order.order_name}
                          </Text>
                          <Text className="text-gray-600 text-xs mt-1">
                            {order.client_name}
                          </Text>
                          {isOnHold && !isSelected && !isDisabled && (
                            <Text className="text-indigo-700 text-[11px] font-semibold mt-1">
                              On Hold
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
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
                  const isProjectLead = projectLeads.includes(packer.id);
                  const canBeProjectLead = isSelected;
                  
                  // Allow deselection if user is team lead or if it's a new assignment
                  const canInteract = packer.is_available || (isSelected && (isTeamLead || !session));

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
                      onPress={() => canInteract && togglePackerSelection(packer.id)}
                      activeOpacity={canInteract ? 0.7 : 1}
                      disabled={!canInteract}
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
                          {!isSelected && !packer.is_available && packer.current_order_name && (
                            <Text className="text-[11px] text-gray-400 mt-0.5">
                              Working on: {packer.current_order_name}
                            </Text>
                          )}
                          {!isSelected && !packer.is_available && !packer.current_order_name && (
                            <Text className="text-[11px] text-gray-400 mt-0.5">
                              Status: {packer.packer_status}
                            </Text>
                          )}
                          {isSelected && selectedOrder && (
                            <Text className="text-[11px] text-primary-600 mt-0.5">
                              Selected for this project
                            </Text>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity 
                        onPress={(e) => {
                          e.stopPropagation();
                          toggleProjectLead(packer.id);
                        }}
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

        {/* Next/Update Button - Always show when order is selected */}
        {selectedOrder && (
          <View className={`${isCompact ? 'mt-3' : 'mt-4'} flex-row justify-end items-center`}>
            {canReleaseOrder && (
              <TouchableOpacity
                onPress={prepareReleaseModal}
                disabled={releaseModalLoading}
                className={`${isCompact ? 'px-4 py-2' : 'px-5 py-3'} mr-3 rounded-lg border ${
                  releaseModalLoading ? 'bg-red-100 border-red-200' : 'bg-red-50 border-red-500'
                }`}
              >
                <Text className={`font-semibold ${releaseModalLoading ? 'text-red-400' : 'text-red-700'}`}>
                  {releaseModalLoading ? 'Preparing...' : 'Release Project'}
                </Text>
              </TouchableOpacity>
            )}
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
                {session && session.order_id === selectedOrder ? '✓ Update Team' : '▷ Next'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
