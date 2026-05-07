import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, useWindowDimensions, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../utils/AuthContext';
import { usePackerSession } from '../../utils/PackerSessionContext';
import { db } from '../../utils/api/supabase';
import { teamLead } from '../../utils/api/teamLead';
import { NavigationButtons } from '../../components/NavigationButtons';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ActiveTaskSummary, buildActiveTaskSummaries, formatBoxList, formatPackerList } from '../../utils/tasks/activeTaskSummaries';

interface Order {
  id: string;
  order_name: string;
  description: string;
  project_type?: 'standard' | 'maintenance' | 'survey' | null;
  client_name: string;
  production_status: string;
  assigned_packers_count: number;
}

interface ClientOption {
  id: string;
  name: string;
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
  const { createSession, session, clearSession, loading: sessionLoading } = usePackerSession();
  const router = useRouter();
  const toast = useToast();
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
  const [releaseModalVisible, setReleaseModalVisible] = useState(false);
  const [releaseModalLoading, setReleaseModalLoading] = useState(false);
  const [releaseSummary, setReleaseSummary] = useState<ActiveTaskSummary[]>([]);
  const [releaseTargets, setReleaseTargets] = useState<string[]>([]);
  // Add/Remove packer mode
  const [isAddRemoveMode, setIsAddRemoveMode] = useState(false);
  const [packerActionModal, setPackerActionModal] = useState<{visible: boolean; packerId: string | null; packerName: string; action: 'add' | 'remove'}>({visible: false, packerId: null, packerName: '', action: 'add'});
  const [projectTypeFilter, setProjectTypeFilter] = useState<'standard' | 'maintenance' | 'survey'>('standard');
  const [maintViewMode, setMaintViewMode] = useState<'view' | 'create'>('view');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [generatedName, setGeneratedName] = useState('');
  const [manualName, setManualName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  const resetDashboardSelectionState = () => {
    if (!session?.order_id) {
      setSelectedOrder(null);
    }
    setSelectedPackers([]);
    setProjectLeads([]);
    setIsTeamLead(false);
    setIsAddRemoveMode(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (sessionLoading) return; // Don't reset state while loading session

      setIsAddRemoveMode(false);
      if (session?.order_id) {
        setSelectedOrder(session.order_id);
      }
      return () => {
        setIsAddRemoveMode(false);
      };
    }, [session?.order_id, sessionLoading])
  );

  // Check for existing session and restore state
  useEffect(() => {
    if (sessionLoading) return; // Wait for session to load before restoring or resetting state

    if (session && session.order_id) {
      // User has an active session, restore their previous selections
      restoreSessionState();
    } else {
      // No active session means the user should be free to pick any project.
      resetDashboardSelectionState();
    }
  }, [session?.order_id, sessionLoading]);

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
          setProjectLeads([]);
          setIsTeamLead(false);
        }
      } catch (error) {
        console.error('Error loading team leads:', error);
        setProjectLeads([]);
        setIsTeamLead(false);
      }
    };
    
    loadOrderTeamLeads();
  }, [selectedOrder, profile?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadSelectedOrderAssignments = async () => {
      if (!selectedOrder) {
        setIsAddRemoveMode(false);
        return;
      }

      try {
        const { data: orderPackers, error } = await db.getOrderPackers(selectedOrder);
        if (error) {
          console.error('Error loading selected order packers:', error);
          return;
        }

        if (cancelled) return;

        const normalizedPackers = normalizeOrderPackers(orderPackers);
        const assignedIds = collectPackerIds(normalizedPackers);

        if (assignedIds.length > 0) {
          setSelectedPackers(assignedIds);
        } else if (profile?.id) {
          const currentUser = allPackers.find((packer) => packer.id === profile.id);
          if (currentUser?.is_available) {
            setSelectedPackers([profile.id]);
          } else {
            setSelectedPackers([]);
          }
        } else {
          setSelectedPackers([]);
        }

        setIsAddRemoveMode(false);
      } catch (error) {
        console.error('Error syncing selected order assignments:', error);
      }
    };

    void loadSelectedOrderAssignments();

    return () => {
      cancelled = true;
    };
  }, [selectedOrder, allPackers, profile?.id]);

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
      } else {
        setSelectedPackers([]);
        setProjectLeads([]);
      }
      
      console.log('Session state restored for order:', session.order_id);
    } catch (error) {
      console.error('Error restoring session state:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
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
        
        // Auto-select the logged-in user if they're available and make them team lead
        const currentUserId = profile?.id;
        if (currentUserId) {
          const currentUser = transformedPackers.find(packer => packer.id === currentUserId);
          if (currentUser && currentUser.is_available) {
            setSelectedPackers(prev => (prev.includes(currentUserId) ? prev : [...prev, currentUserId]));
            // Auto-set as team lead since they're the first one joining
            setProjectLeads(prev => (prev.includes(currentUserId) ? prev : [...prev, currentUserId]));
            console.log('Auto-selected current user as packer and team lead:', currentUser.full_name);
          }
        }
      }
    } catch (error) {
      console.error('Error in loadData:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOrdersForType = (type: 'standard' | 'maintenance' | 'survey') =>
    availableOrders.filter((order) => (order.project_type || 'standard') === type);

  const buildAutoProjectName = (clientName: string) => {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}-${mm}${dd}`;
    const clientToken = String(clientName || 'CLIENT')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9-]/g, '') || 'CLIENT';

    const todaysClientCount = getOrdersForType(projectTypeFilter).filter((order) => {
      const upperName = String(order.order_name || '').toUpperCase();
      return upperName.includes(datePrefix) && upperName.includes(`-${clientToken}-`);
    }).length;

    const sequence = String(todaysClientCount + 1).padStart(2, '0');
    return `${datePrefix}-V01-${clientToken}-${sequence}`;
  };

  const refreshAutoNameForClient = (clientId: string | null, sourceClients: ClientOption[] = clients) => {
    const selectedClient = sourceClients.find((client) => client.id === clientId);
    const nextName = buildAutoProjectName(selectedClient?.name || 'DEWA');
    setGeneratedName(nextName);
    setManualName(nextName);
  };

  const openCreateProjectModal = async () => {
    try {
      const { data, error } = await db.getClients();
      if (error) {
        toast.error('Failed to load clients');
        return;
      }

      const clientOptions = (data || []) as ClientOption[];
      if (clientOptions.length === 0) {
        toast.error('No clients available. Please contact admin to add at least one client.');
        return;
      }

      setClients(clientOptions);

      const defaultClient = clientOptions.find((client) => String(client.name).toUpperCase() === 'DEWA') || clientOptions[0] || null;
      const defaultClientId = defaultClient?.id || null;
      setSelectedClientId(defaultClientId);
      refreshAutoNameForClient(defaultClientId, clientOptions);
      setClientPickerOpen(false);
      setCreateModalVisible(true);
    } catch (error) {
      console.error('Error opening create project modal:', error);
      toast.error('Could not open create project form');
    }
  };

  const closeCreateProjectModal = () => {
    if (creatingProject) return;
    setCreateModalVisible(false);
    setSelectedClientId(null);
    setClientPickerOpen(false);
    setGeneratedName('');
    setManualName('');
  };

  const handleCreateProject = async () => {
    if (projectTypeFilter === 'standard') {
      toast.error('Standard projects are created by admin');
      return;
    }

    if (!selectedClientId) {
      toast.error('Please select a client');
      return;
    }

    try {
      setCreatingProject(true);
      const customName = manualName.trim();
      const { data, error } = await db.createPackerProject({
        projectType: projectTypeFilter,
        clientId: selectedClientId,
        createdBy: profile?.id || null,
        orderName: customName || generatedName,
      });

      if (error || !data) {
        console.error('Error creating project:', error);
        toast.error(error?.message || 'Failed to create project');
        return;
      }

      await loadData();
      setSelectedOrder(data.order_id);
      setMaintViewMode('view');
      closeCreateProjectModal();
      toast.success(`${projectTypeFilter === 'maintenance' ? 'Maintenance' : 'Survey'} project created`);
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Unexpected error while creating project');
    } finally {
      setCreatingProject(false);
    }
  };

  useEffect(() => {
    if (loading || sessionLoading) return;

    if (selectedOrder) {
      const selected = availableOrders.find((order) => order.id === selectedOrder);
      if (selected) {
        const selectedType = (selected.project_type || 'standard') as 'standard' | 'maintenance' | 'survey';
        if (selectedType !== projectTypeFilter) {
          setProjectTypeFilter(selectedType);
          return;
        }
      }
    }

    if (projectTypeFilter === 'standard') {
      setMaintViewMode('view');
    }
    
    // Only clear selectedOrder if it's truly invalid and NOT part of an active session
    if (selectedOrder && !sessionLoading) {
      const allOrders = availableOrders;
      const orderExists = allOrders.some(o => o.id === selectedOrder);
      const isCurrentSessionOrder = session?.order_id === selectedOrder;
      
      // If it's not in the current filter, check if we should switch filters instead of clearing
      const validForFilter = getOrdersForType(projectTypeFilter).some((order) => order.id === selectedOrder);
      
      if (!validForFilter && orderExists && !isCurrentSessionOrder) {
        // If it exists but filter is wrong, and it's not our active session, clear it
        setSelectedOrder(null);
      } else if (!orderExists && !isCurrentSessionOrder) {
        // If it doesn't exist at all and isn't our session, clear it
        setSelectedOrder(null);
      }
    }
  }, [projectTypeFilter, availableOrders, selectedOrder, loading, sessionLoading]);

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
        toast.error('Unable to load current team for this project');
        setReleaseTargets([]);
        return;
      }

      const normalizedPackers = normalizeOrderPackers(orderPackers);
      const targetIds = collectPackerIds(normalizedPackers);

      if (targetIds.length === 0) {
        toast.error('There are no packers assigned to this project.');
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
      toast.error('Unexpected error preparing release confirmation');
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

      toast.success('Team removed and project unlocked for others.');
      setSelectedOrder(null);
      setSelectedPackers([]);
      resetReleaseModalState();
      await loadData();
    } catch (error) {
      console.error('Error releasing project:', error);
      toast.error('Could not release this project.');
    } finally {
      setReleaseModalLoading(false);
    }
  };

  const handleCloseReleaseModal = () => {
    if (releaseModalLoading) return;
    resetReleaseModalState();
  };

  // Handle add/remove packer action
  const handlePackerAction = async () => {
    if (!packerActionModal.packerId || !selectedOrder) return;
    
    const { packerId, action } = packerActionModal;
    const packer = allPackers.find(p => p.id === packerId);
    
    try {
      if (action === 'remove') {
        // Complete tasks for this packer
        const { error: taskError } = await db.completeAssignmentsForPackers(selectedOrder, [packerId]);
        if (taskError) {
          console.warn('Failed to complete tasks for packer:', taskError);
        }
        
        // End attendance for this packer
        const { error: attendanceError } = await db.endAttendanceForPackers(selectedOrder, [packerId]);
        if (attendanceError) {
          console.warn('Failed to end attendance for packer:', attendanceError);
        }
        
        // Remove from order
        const { error: removeError } = await db.removePackerFromOrder(selectedOrder, packerId);
        if (removeError) {
          toast.error('Failed to remove packer from project');
          return;
        }
        
        // If removing a project lead, remove lead status
        if (projectLeads.includes(packerId)) {
          await teamLead.removeTeamLead(selectedOrder, packerId);
          setProjectLeads(prev => prev.filter(id => id !== packerId));
        }
        
        // Update local state
        setSelectedPackers(prev => prev.filter(id => id !== packerId));
        
        // Update packer status locally (mark as available)
        setAllPackers(prev => prev.map(p => 
          p.id === packerId 
            ? { ...p, packer_status: 'available', is_available: true, current_order_name: null }
            : p
        ));
        
        // If removing self, clear session
        if (packerId === profile?.id) {
          clearSession();
          resetDashboardSelectionState();
          await loadData();
        }
        
        toast.success(`${packer?.full_name || 'Packer'} has been removed from the team`);
      } else {
        // Add packer to order
        const { data: orderData } = await db.getOrderById(selectedOrder);
        if (!orderData) {
          toast.error('Could not load order details');
          return;
        }
        
        const { error: addError } = await db.addPackerToOrder(selectedOrder, packerId, orderData);
        if (addError) {
          toast.error('Failed to add packer to project');
          return;
        }

        // Auto-assign as team lead if the user is adding themselves
        if (packerId === profile?.id) {
          await teamLead.addTeamLead(selectedOrder, packerId);
          setProjectLeads(prev => {
            const next = prev.includes(packerId) ? prev : [...prev, packerId];
            if (next.length === 1) {
              db.updateProjectLead(selectedOrder, packerId).catch(err => console.warn('Failed to update primary lead', err));
            }
            return next;
          });
          setIsTeamLead(true);
        }
        
        // Create session for the new packer
        await db.createTeamSessions(selectedOrder, orderData, [packerId]);
        
        // Update local state
        setSelectedPackers(prev => [...prev, packerId]);
        
        // Update packer status locally (mark as busy with current order)
        const orderName = availableOrders.find(o => o.id === selectedOrder)?.order_name || '';
        setAllPackers(prev => prev.map(p => 
          p.id === packerId 
            ? { ...p, packer_status: 'busy', is_available: false, current_order_name: orderName }
            : p
        ));
        
        toast.success(`${packer?.full_name || 'Packer'} has been added to the team`);
      }
      
      // No need to reload all data - we've updated local state
    } catch (error) {
      console.error('Error in packer action:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setPackerActionModal({visible: false, packerId: null, packerName: '', action: 'add'});
    }
  };

  const openAddPackerModal = (packerId: string, packerName: string) => {
    setPackerActionModal({visible: true, packerId, packerName, action: 'add'});
  };

  const openRemovePackerModal = (packerId: string, packerName: string) => {
    setPackerActionModal({visible: true, packerId, packerName, action: 'remove'});
  };

  const togglePackerSelection = (packerId: string) => {
    const packer = allPackers.find(p => p.id === packerId);
    if (!packer) return;

    const isCurrentlySelected = selectedPackers.includes(packerId);
    const selectedOrderInfo = selectedOrder ? availableOrders.find((order) => order.id === selectedOrder) : null;
    const isExistingTeamOrder = Boolean(
      (selectedOrderInfo?.assigned_packers_count || 0) > 0 ||
      (session && session.order_id === selectedOrder)
    );
    const hasAnyLead = projectLeads.length > 0;
    const currentUserId = profile?.id || '';
    const currentUserIsLead = Boolean(currentUserId && projectLeads.includes(currentUserId));
    
    // For orders with existing team: only allow team leads to modify selection
    if (isExistingTeamOrder && hasAnyLead && !(isTeamLead || currentUserIsLead)) {
      toast.error('Only team leads can modify team membership');
      return;
    }
    
    // If it's an existing team order, we use the modal-based immediate update flow
    if (isExistingTeamOrder) {
      if (isCurrentlySelected) {
        openRemovePackerModal(packerId, packer.full_name);
      } else {
        if (!packer.is_available) {
          toast.error(`${packer.full_name} is currently unavailable`);
          return;
        }
        openAddPackerModal(packerId, packer.full_name);
      }
      return;
    }

    // For new project selection, just toggle local state
    if (isCurrentlySelected) {
      // Deselecting a packer
      if (projectLeads.includes(packerId)) {
        setProjectLeads(prevLeads => prevLeads.filter(id => id !== packerId));
      }
      setSelectedPackers(prev => prev.filter(id => id !== packerId));
    } else {
      // Selecting a packer
      if (!packer.is_available) {
        toast.error(`${packer.full_name} is currently unavailable`);
        return;
      }
      setSelectedPackers(prev => [...prev, packerId]);
    }
  };

  const toggleProjectLead = async (packerId: string) => {
    if (!selectedOrder) {
      return;
    }

    // Only allow project lead selection from selected packers
    if (!selectedPackers.includes(packerId)) {
      toast.error('Please select this packer as a team member first');
      return;
    }
    
    const selectedOrderInfo = availableOrders.find((order) => order.id === selectedOrder);
    const isExistingTeamOrder = Boolean(
      (selectedOrderInfo?.assigned_packers_count || 0) > 0 ||
      (session && session.order_id === selectedOrder)
    );
    const hasAnyLead = projectLeads.length > 0;
    const currentUserId = profile?.id || '';
    const currentUserIsLead = Boolean(currentUserId && projectLeads.includes(currentUserId));
    const canCurrentUserManageLeads = isTeamLead || currentUserIsLead || !hasAnyLead;
    
    // For orders with existing team: only allow team leads to modify lead assignments
    if (isExistingTeamOrder && hasAnyLead && !canCurrentUserManageLeads) {
      toast.error('Only team leads can assign team lead roles');
      return;
    }

    const isCurrentlyLead = projectLeads.includes(packerId);
    const nextLeadIds = isCurrentlyLead
      ? projectLeads.filter((id) => id !== packerId)
      : [...projectLeads, packerId];

    if (isCurrentlyLead && nextLeadIds.length === 0) {
      toast.error('At least one team lead is required');
      return;
    }

    if (!isExistingTeamOrder) {
      setProjectLeads(nextLeadIds);
      if (currentUserId) {
        setIsTeamLead(nextLeadIds.includes(currentUserId));
      }
      return;
    }

    const { error: leadMutationError } = isCurrentlyLead
      ? await teamLead.removeTeamLead(selectedOrder, packerId)
      : await teamLead.addTeamLead(selectedOrder, packerId);

    if (leadMutationError) {
      console.error('Error updating team lead role:', leadMutationError);
      toast.error('Could not update team lead role. Please try again.');
      return;
    }

    setProjectLeads(nextLeadIds);
    if (currentUserId) {
      setIsTeamLead(nextLeadIds.includes(currentUserId));
    }

    if (nextLeadIds.length > 0) {
      const { error: primaryLeadError } = await db.updateProjectLead(selectedOrder, nextLeadIds[0]);
      if (primaryLeadError) {
        console.warn('Project lead update (orders table) failed:', primaryLeadError);
      }
    } else {
      const { error: clearLeadError } = await db.clearProjectLead(selectedOrder);
      if (clearLeadError) {
        console.warn('Project lead clear failed:', clearLeadError);
      }
    }
  };

  const handleNext = async () => {
    if (!selectedOrder) {
      toast.error('Please select a project');
      return;
    }

    if (selectedPackers.length === 0) {
      toast.error('Please select at least one packer');
      return;
    }

    const isActiveSession = session && session.order_id === selectedOrder;

    try {
      // Get order details first
      const { data: orderData, error: orderError } = await db.getOrderById(selectedOrder);
      if (orderError || !orderData) {
        console.error('Error getting order details:', orderError);
        toast.error('Failed to get project details');
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
        if (projectLeads.length > 0) {
          await db.updateProjectLead(selectedOrder, projectLeads[0]);
        } else {
          await db.clearProjectLead(selectedOrder);
        }
        
        toast.success('Team changes saved successfully');
        
        // Force complete reload of local data
        await loadData();
        
        // Navigate to attendance screen
        router.push({
          pathname: '/(packer)/attendance',
          params: { 
            orderId: selectedOrder
          }
        });
      } else {
        // New assignment - original flow
        const { data: existingTeamData, error: existingTeamError } = await db.getOrderPackers(selectedOrder);
        if (existingTeamError) {
          console.error('Error validating existing team before assignment:', existingTeamError);
          toast.error('Failed to validate current project team. Please try again.');
          return;
        }

        const existingTeamIds = collectPackerIds(normalizeOrderPackers(existingTeamData));
        const userAlreadyOnTeam = Boolean(profile?.id && existingTeamIds.includes(profile.id));

        if (existingTeamIds.length > 0 && !userAlreadyOnTeam) {
          toast.error('This project already has an active team. Choose another project.');
          resetDashboardSelectionState();
          await loadData();
          return;
        }

        // Assign packers to order
        const { error: assignError } = await db.assignPackersToOrder(selectedOrder, selectedPackers);
        
        if (assignError) {
          toast.error('Failed to assign team to project');
          return;
        }

        // Assign team leads using the new multi-lead system
        await teamLead.removeAllTeamLeads(selectedOrder);

        if (projectLeads.length > 0) {
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
        } else {
          const { error: clearLeadError } = await db.clearProjectLead(selectedOrder);
          if (clearLeadError) {
            console.warn('Project lead clear failed:', clearLeadError);
          }
        }

        // Create sessions for all selected packers (team-based sessions)
        const { data: teamSessions, error: sessionError } = await db.createTeamSessions(selectedOrder, orderData, selectedPackers);
        if (sessionError || !teamSessions) {
          console.error('Failed to create team sessions:', sessionError);
          toast.warning('Failed to create team sessions, but you can continue');
        } else {
          console.log(`Created ${teamSessions.length} team sessions for selected packers`);
          toast.success(`Created sessions for ${teamSessions.length} team members`);
          
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
      toast.error('An unexpected error occurred');
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out error:', error);
        toast.error('Failed to sign out');
      } else {
        // Force navigation to login after successful sign out
        router.replace('/auth/login');
      }
    } catch (error) {
      console.error('Unexpected sign out error:', error);
      toast.error('An unexpected error occurred during sign out');
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
  const ordersForType = getOrdersForType(projectTypeFilter);
  const visibleOrders = projectTypeFilter === 'standard'
    ? ordersForType.filter((order) => order.production_status !== 'completed')
    : ordersForType.filter((order) => ['pending', 'in_progress', 'on_hold'].includes(order.production_status));
  const selectedOrderRecord = selectedOrder
    ? availableOrders.find((order) => order.id === selectedOrder) || null
    : null;
  const selectedOrderHasExistingTeam = Boolean(
    selectedOrderRecord && selectedOrderRecord.assigned_packers_count > 0
  );
  const isSessionForSelectedOrder = Boolean(session && session.order_id === selectedOrder);
  const currentUserId = profile?.id || '';
  const isCurrentUserOnSelectedTeam = Boolean(currentUserId && selectedPackers.includes(currentUserId));
  const isCurrentUserLead = Boolean(currentUserId && projectLeads.includes(currentUserId));
  const canManageByLeadRole = isCurrentUserLead || isTeamLead || projectLeads.length === 0;
  const canManageActiveTeam = Boolean(
    selectedOrder &&
    (!selectedOrderHasExistingTeam || isSessionForSelectedOrder || isCurrentUserOnSelectedTeam)
  );
  const canReleaseOrder = Boolean(
    selectedOrder &&
    session?.order_id === selectedOrder &&
    profile?.id &&
    selectedPackers.includes(profile.id) &&
    ((isTeamLead || isCurrentUserLead) || isOnlySelfOnTeam)
  );
  const selectedOrderOccupiedByAnotherTeam = Boolean(
    selectedOrderRecord &&
    selectedOrderRecord.assigned_packers_count > 0 &&
    session?.order_id !== selectedOrder
  );
  const isCreateModeActive = projectTypeFilter !== 'standard' && maintViewMode === 'create';

  const handleToggleAddRemoveMode = () => {
    setIsAddRemoveMode(!isAddRemoveMode);
  };

  if (loading || sessionLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={['top','bottom','left','right']}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0891b2" />
          <Text className="text-lg text-gray-600 mt-4">Loading session...</Text>
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
  <NavigationButtons currentScreen="dashboard" onDashboardRefresh={loadData} />

      {/* Add/Remove Packer Confirmation Modal */}
      <ConfirmModal
        visible={packerActionModal.visible}
        title={packerActionModal.action === 'add' ? 'Add Packer' : 'Remove Packer'}
        description={packerActionModal.action === 'add' 
          ? `Are you sure you want to add ${packerActionModal.packerName} to the team?`
          : `Are you sure you want to remove ${packerActionModal.packerName} from the team? This will end their attendance and complete their active tasks.`}
        confirmText={packerActionModal.action === 'add' ? 'Add' : 'Remove'}
        cancelText="Cancel"
        variant={packerActionModal.action === 'add' ? 'default' : 'danger'}
        onConfirm={handlePackerAction}
        onCancel={() => setPackerActionModal({visible: false, packerId: null, packerName: '', action: 'add'})}
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

      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCreateProjectModal}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={closeCreateProjectModal}
          className="flex-1 bg-black/40 justify-center items-center p-4"
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(event) => event.stopPropagation()}
            className="bg-white rounded-xl w-full max-w-2xl max-h-[85%]"
          >
            <View className="px-5 py-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-gray-900">
                Create New {projectTypeFilter === 'maintenance' ? 'Maintenance' : 'Survey'} Project
              </Text>
            </View>

            <ScrollView className="px-5 py-4">
              <Text className="text-sm text-gray-700 mb-2 font-medium">Client</Text>
              <View className="mb-4">
                <TouchableOpacity
                  onPress={() => setClientPickerOpen((previous) => !previous)}
                  className="border border-gray-300 rounded-lg px-4 py-3 bg-white flex-row items-center justify-between"
                >
                  <Text className="text-gray-900 text-base font-medium">
                    {(clients.find((client) => client.id === selectedClientId)?.name) || 'Select client'}
                  </Text>
                  <Text className="text-gray-500 text-lg">{clientPickerOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {clientPickerOpen && (
                  <View className="mt-2 border border-gray-200 rounded-lg overflow-hidden bg-white max-h-72">
                    <ScrollView>
                      {(clients || []).length === 0 ? (
                        <View className="px-3 py-3 bg-white">
                          <Text className="text-gray-500 text-sm">No clients available</Text>
                        </View>
                      ) : (
                        (clients || []).map((client) => {
                          const isSelected = selectedClientId === client.id;
                          return (
                            <TouchableOpacity
                              key={client.id}
                              onPress={() => {
                                setSelectedClientId(client.id);
                                refreshAutoNameForClient(client.id);
                                setClientPickerOpen(false);
                              }}
                              className={`px-3 py-3 border-b border-gray-100 ${isSelected ? 'bg-blue-50' : 'bg-white'}`}
                            >
                              <Text className={`${isSelected ? 'text-blue-700' : 'text-gray-900'} font-medium`}>
                                {client.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <Text className="text-sm text-gray-700 mb-2 font-medium">Project Name</Text>
              <TextInput
                value={manualName}
                onChangeText={setManualName}
                placeholder="Auto-generated project name"
                className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900 mb-2"
              />
              <Text className="text-xs text-gray-500 mb-4">
                Suggested: {generatedName || '—'}
              </Text>
            </ScrollView>

            <View className="px-5 py-4 border-t border-gray-200 flex-row gap-2">
              <TouchableOpacity
                onPress={closeCreateProjectModal}
                disabled={creatingProject}
                className="flex-1 bg-gray-100 rounded-lg py-3"
              >
                <Text className="text-center text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateProject}
                disabled={creatingProject || !selectedClientId}
                className={`flex-1 rounded-lg py-3 ${creatingProject || !selectedClientId ? 'bg-gray-300' : 'bg-green-600'}`}
              >
                {creatingProject ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-center text-white font-semibold">Create Project</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Main Content */}
      <View className={`flex-1 ${isCompact ? 'p-3' : 'p-4'}`}>
        <View className={`${isPortraitStack ? 'flex-col gap-y-3' : (isCompact ? 'flex-row gap-x-3' : 'flex-row gap-x-4')} flex-1`}>
          {/* Left Column - Select File */}
          <View className="flex-1 bg-white rounded-lg shadow-sm">
            <View className={`bg-primary-500 ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} rounded-t-lg`}>
              <View className="flex-row items-center justify-between">
                <Text className={`${isCompact ? 'text-sm' : 'text-base'} text-white font-semibold`}>
                  Select File
                </Text>
                <View className="flex-row gap-1">
                  {(['standard', 'maintenance', 'survey'] as const).map((type) => {
                    const isActive = projectTypeFilter === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setProjectTypeFilter(type)}
                        className={`px-2 py-1 rounded ${isActive ? 'bg-primary-700' : 'bg-primary-400'}`}
                      >
                        <Text className="text-white text-[11px] font-semibold">
                          {type === 'standard' ? 'Standard' : type === 'maintenance' ? 'Maintenance' : 'Survey'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {projectTypeFilter !== 'standard' && (
              <View className={`${isCompact ? 'px-3 py-2' : 'px-4 py-3'} border-b border-blue-100 bg-blue-50 flex-row items-center justify-between`}>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setMaintViewMode('view')}
                    className={`px-3 py-2 rounded ${maintViewMode === 'view' ? 'bg-blue-600' : 'bg-white border border-blue-200'}`}
                  >
                    <Text className={`${maintViewMode === 'view' ? 'text-white' : 'text-blue-700'} text-xs font-semibold`}>
                      View Existing
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setMaintViewMode('create')}
                    className={`px-3 py-2 rounded ${maintViewMode === 'create' ? 'bg-green-600' : 'bg-white border border-green-200'}`}
                  >
                    <Text className={`${maintViewMode === 'create' ? 'text-white' : 'text-green-700'} text-xs font-semibold`}>
                      Create New
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            <ScrollView className={`flex-1 ${isCompact ? 'p-3' : 'p-4'}`}>
{isCreateModeActive ? (
                <View className="p-3 rounded-lg border border-green-200 bg-green-50">
                  <Text className="text-green-800 font-semibold mb-2">
                    Create New {projectTypeFilter === 'maintenance' ? 'Maintenance' : 'Survey'} Project
                  </Text>
                  <Text className="text-green-700 text-xs mb-3">
                    Generate a new project with package #1 and pending maintenance task flow.
                  </Text>
                  <TouchableOpacity
                    onPress={openCreateProjectModal}
                    className="bg-green-600 rounded-lg px-4 py-3"
                  >
                    <Text className="text-white text-center font-semibold">+ Create New Project</Text>
                  </TouchableOpacity>
                </View>
              ) : visibleOrders.length === 0 ? (
                <Text className="text-gray-500 text-center py-6">
                  No projects available
                </Text>
              ) : (
                visibleOrders.map((order) => {
                  const hasActiveSession = !!session?.order_id;
                  const isUsersActiveOrder = hasActiveSession && session?.order_id === order.id;
                  const isLockedBySession = hasActiveSession && !isUsersActiveOrder; // user already working on another order
                  const hasAssignedTeam = (order.assigned_packers_count || 0) > 0;
                  const isOccupiedByAnotherTeam = hasAssignedTeam && !isUsersActiveOrder;
                  const isGloballyLocked = (order.production_status === 'in_progress' || isOccupiedByAnotherTeam) && !isUsersActiveOrder;
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
                          {isOccupiedByAnotherTeam && (
                            <Text className="text-yellow-700 text-[11px] font-semibold mt-1">
                              Occupied by another team
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
            <View className={`bg-primary-500 ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} rounded-t-lg flex-row justify-between items-center`}>
              <Text className={`${isCompact ? 'text-sm' : 'text-base'} text-white font-semibold`}>
                Select Packers
              </Text>
              <View className="flex-row items-center gap-2">
                {canReleaseOrder && (
                  <TouchableOpacity
                    onPress={prepareReleaseModal}
                    disabled={releaseModalLoading}
                    className={`px-3 py-1 rounded-md border ${
                      releaseModalLoading ? 'bg-red-100 border-red-200' : 'bg-red-50 border-red-400'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${releaseModalLoading ? 'text-red-400' : 'text-red-700'}`}>
                      {releaseModalLoading ? '...' : '⇄ Release Team'}
                    </Text>
                  </TouchableOpacity>
                )}
                {selectedOrder && (
                  <TouchableOpacity
                    onPress={handleToggleAddRemoveMode}
                    className={`px-3 py-1 rounded-md ${isAddRemoveMode ? 'bg-green-600' : 'bg-white'}`}
                  >
                    <Text className={`text-xs font-bold ${isAddRemoveMode ? 'text-white' : 'text-primary-600'}`}>
                      {isAddRemoveMode ? '✕ Done' : '± Add/Remove Packer'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            <View className={`${isCompact ? 'p-3' : 'p-4'}`}>
              <View className={`flex-row justify-between items-center ${isCompact ? 'mb-2' : 'mb-4'}`}>
                <Text className={`${isCompact ? 'text-sm' : 'text-base'} text-gray-700 font-medium`}>Packer Name</Text>
                <Text className={`${isCompact ? 'text-sm' : 'text-base'} text-gray-700 font-medium`}>Project Lead</Text>
              </View>
              {selectedOrderOccupiedByAnotherTeam && (
                <View className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2">
                  <Text className="text-[11px] font-semibold text-yellow-700">
                    This project already has an assigned team. You cannot join it directly.
                  </Text>
                </View>
              )}
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
                  const isExistingTeamOrder = selectedOrderHasExistingTeam || isSessionForSelectedOrder;
                  
                  // Check if packer is busy on another project
                  const isBusyOnOtherProject = !packer.is_available && !isSelected && packer.current_order_name;
                  
                  // Unified selection logic: Must be in add/remove mode to change selection
                  const canClickToSelect = Boolean(
                    isAddRemoveMode &&
                    selectedOrder &&
                    !selectedOrderOccupiedByAnotherTeam &&
                    (packer.is_available || isSelected)
                  );

                  const cardCls = `${isCompact ? 'p-2' : 'p-3'} mb-2 rounded-lg border flex-row items-center justify-between ${
                    isSelected
                      ? 'bg-primary-50 border-primary-500'
                      : isBusyOnOtherProject
                      ? 'bg-yellow-50 border-yellow-400'
                      : !packer.is_available
                      ? 'bg-gray-100 border-gray-300 opacity-50'
                      : 'bg-gray-50 border-gray-200'
                  }`;
                  
                  // Wrapper component - use TouchableOpacity for new project selection, otherwise View
                  const CardWrapper = canClickToSelect ? TouchableOpacity : View;
                  const cardWrapperProps = canClickToSelect ? { onPress: () => togglePackerSelection(packer.id) } : {};
                  
                  return (
                    <CardWrapper
                      key={packer.id}
                      className={cardCls}
                      {...cardWrapperProps}
                    >
                      <View className="flex-row items-center flex-1">
                        <View className={`w-4 h-4 rounded mr-3 ${
                          isSelected
                            ? 'bg-primary-500'
                            : isBusyOnOtherProject
                            ? 'bg-yellow-400'
                            : packer.is_available
                            ? 'bg-gray-300'
                            : 'bg-gray-200'
                        }`} />
                        <View className="flex-1">
                          <Text className={`font-medium ${
                            isSelected ? 'text-primary-700' : isBusyOnOtherProject ? 'text-yellow-700' : (packer.is_available ? 'text-gray-900' : 'text-gray-400')
                          }`}>
                            {packer.full_name}
                          </Text>
                          {!isSelected && !packer.is_available && packer.current_order_name && (
                            <Text className="text-[11px] text-yellow-600 mt-0.5 font-medium">
                              Working on: {packer.current_order_name}
                            </Text>
                          )}
                          {!isSelected && !packer.is_available && !packer.current_order_name && (
                            <Text className="text-[11px] text-gray-400 mt-0.5">
                              Status: {packer.packer_status}
                            </Text>
                          )}
                          {isSelected && selectedOrder && !isAddRemoveMode && (
                            <Text className="text-[11px] text-primary-600 mt-0.5">
                              On this project
                            </Text>
                          )}
                        </View>
                      </View>
                      
                      {/* Lead Toggle and Checkbox indicator in add/remove mode */}
                      {isAddRemoveMode && (
                        <View className="flex-row items-center gap-2">
                          {isSelected && (
                            <TouchableOpacity 
                              onPress={(e) => {
                                e.stopPropagation();
                                void toggleProjectLead(packer.id);
                              }}
                              className={`px-2 py-1.5 rounded-lg border ${
                                isProjectLead
                                  ? 'bg-primary-500 border-primary-500'
                                  : 'bg-white border-gray-300'
                              }`}
                            >
                              <Text className={`text-xs font-semibold ${isProjectLead ? 'text-white' : 'text-gray-600'}`}>
                                {isProjectLead ? '★ Lead' : 'Make Lead'}
                              </Text>
                            </TouchableOpacity>
                          )}
                          <View className={`w-5 h-5 rounded-md border items-center justify-center ${
                            isSelected ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-300'
                          }`}>
                            {isSelected && <Text className="text-white text-[10px] font-bold">✓</Text>}
                          </View>
                        </View>
                      )}
                      
                      {/* Project lead indicator when NOT in add/remove mode */}
                      {!isAddRemoveMode && isSelected && (
                        <View
                          className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                            isProjectLead
                              ? 'bg-primary-500 border-primary-500'
                              : 'border-gray-200 bg-gray-100'
                          }`}
                        >
                          {isProjectLead && (
                            <Text className="text-white text-xs">✓</Text>
                          )}
                        </View>
                      )}
                    </CardWrapper>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>

        {/* Action Buttons - Always show when order is selected */}
        {selectedOrder && (
          <View className={`${isCompact ? 'mt-3' : 'mt-4'} flex-row justify-end items-center`}>
            {/* Action buttons - Next/Resume only */}
            
            {/* Next / Resume button */}
            {(!selectedOrderHasExistingTeam || isCurrentUserOnSelectedTeam) && (
              <TouchableOpacity
                onPress={handleNext}
                disabled={!selectedOrder || selectedPackers.length === 0 || selectedOrderOccupiedByAnotherTeam}
                className={`${isCompact ? 'px-4 py-2' : 'px-6 py-3'} ml-3 rounded-lg ${
                  selectedOrder && selectedPackers.length > 0 && !selectedOrderOccupiedByAnotherTeam
                    ? 'bg-primary-500'
                    : 'bg-gray-300'
                }`}
              >
                <Text className={`font-semibold ${
                  selectedOrder && selectedPackers.length > 0 && !selectedOrderOccupiedByAnotherTeam
                    ? 'text-white'
                    : 'text-gray-500'
                }`}>
                  ▷ Next
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
