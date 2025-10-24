import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Alert, Switch } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { supabase } from '../../utils/api/supabase';
import { useAuth } from '../../utils/AuthContext';
import OrderPackagesEditor from './orders/OrderPackagesEditor';

interface Client {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
}

interface AddOrderModalProps {
  visible: boolean;
  onClose: () => void;
  onOrderAdded: () => void;
}

export default function AddOrderModal({ visible, onClose, onOrderAdded }: AddOrderModalProps) {
  const { user } = useAuth();

  const [orderName, setOrderName] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  // Create-client inline form
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchClients();
    }
  }, [visible]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, contact_person, email')
        .order('name');
      
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const handleCreateClient = async () => {
    const name = clientName.trim();
    if (!name) {
      Alert.alert('Client name is required');
      return;
    }
    setCreatingClient(true);
    try {
      const payload: any = {
        name,
        contact_person: clientContact.trim() || null,
        email: clientEmail.trim() || null,
      };
      const { data, error } = await supabase
        .from('clients')
        .insert(payload)
        .select('id, name, contact_person, email')
        .single();
      if (error) throw error;
      if (data) {
        setClients(prev => [data as Client, ...prev]);
        setSelectedClientId(data.id);
        setShowCreateClient(false);
        setClientName('');
        setClientContact('');
        setClientEmail('');
      }
    } catch (e) {
      console.error('Error creating client:', e);
      Alert.alert('Error', 'Failed to create client');
    } finally {
      setCreatingClient(false);
    }
  };

  const handleSubmit = async () => {
    if (!orderName.trim() || !selectedClientId) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert({
          order_name: orderName.trim(),
          description: description.trim() || null,
          total_estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
          client_id: selectedClientId,
          created_by: user?.id,
          commercial_status: 'draft',
          production_status: 'pending'
        })
        .select('id')
        .single();

      if (error) throw error;

      // Order created; close modal and refresh list
      Alert.alert('Success', 'Order created successfully');
      onOrderAdded();
      onClose();
    } catch (error) {
      console.error('Error creating order:', error);
      Alert.alert('Error', 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const closeAll = () => {
    // Reset form
    setOrderName('');
    setDescription('');
    setEstimatedCost('');
    setSelectedClientId('');
    setShowCreateClient(false);
    setClientName('');
    setClientContact('');
    setClientEmail('');
    onOrderAdded();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity className="flex-1 bg-black/50 justify-center items-center p-4" activeOpacity={1} onPress={onClose}>
        <TouchableOpacity className="bg-white rounded-xl w-full max-w-2xl max-h-5/6" activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View className="flex-row justify-between items-center p-6 border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-900">
              Add New Order
            </Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

              <ScrollView className="flex-1 p-6">
                {/* Order Name */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-2">
                    Order Name *
                  </Text>
                  <TextInput
                    value={orderName}
                    onChangeText={setOrderName}
                    placeholder="Enter order name"
                    className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                  />
                </View>

                {/* Client Selection */}
                <View className="mb-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-medium text-gray-700">
                      Client *
                    </Text>
                    <TouchableOpacity className="flex-row items-center" onPress={() => setShowCreateClient(v => !v)}>
                      <Plus size={16} color="#3b82f6" />
                      <Text className="ml-1 text-blue-600 font-medium">{showCreateClient ? 'Cancel' : 'Add new client'}</Text>
                    </TouchableOpacity>
                  </View>

                  {showCreateClient ? (
                    <View className="border border-gray-300 rounded-lg p-3 mb-3">
                      <Text className="text-xs text-gray-600 mb-1">Client Name *</Text>
                      <TextInput value={clientName} onChangeText={setClientName} placeholder="Company or person" className="border border-gray-300 rounded px-3 py-2 mb-2" />
                      <Text className="text-xs text-gray-600 mb-1">Contact Person</Text>
                      <TextInput value={clientContact} onChangeText={setClientContact} placeholder="Contact person" className="border border-gray-300 rounded px-3 py-2 mb-2" />
                      <Text className="text-xs text-gray-600 mb-1">Email</Text>
                      <TextInput value={clientEmail} onChangeText={setClientEmail} placeholder="Email" keyboardType="email-address" className="border border-gray-300 rounded px-3 py-2 mb-2" />
                      <TouchableOpacity disabled={creatingClient} onPress={handleCreateClient} className={`py-2 rounded ${creatingClient ? 'bg-gray-300' : 'bg-blue-600'}`}>
                        <Text className="text-white text-center font-medium">{creatingClient ? 'Creating...' : 'Create Client'}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <ScrollView className="max-h-40 border border-gray-300 rounded-lg">
                    {clients.map((client) => (
                      <TouchableOpacity
                        key={client.id}
                        onPress={() => setSelectedClientId(client.id)}
                        className={`p-3 border-b border-gray-100 ${
                          selectedClientId === client.id ? 'bg-primary-50' : ''
                        }`}
                      >
                        <Text className={`font-medium ${
                          selectedClientId === client.id ? 'text-primary-600' : 'text-gray-900'
                        }`}>
                          {client.name}
                        </Text>
                        {client.contact_person && (
                          <Text className="text-xs text-gray-500">
                            Contact: {client.contact_person}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Description */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-2">
                    Description
                  </Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Enter order description"
                    multiline
                    numberOfLines={3}
                    className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                    style={{ textAlignVertical: 'top' }}
                  />
                </View>

                {/* Estimated Cost */}
                <View className="mb-6">
                  <Text className="text-sm font-medium text-gray-700 mb-2">
                    Estimated Cost (AED)
                  </Text>
                  <TextInput
                    value={estimatedCost}
                    onChangeText={setEstimatedCost}
                    placeholder="0.00"
                    keyboardType="numeric"
                    className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                  />
                </View>
              </ScrollView>

              {/* Footer */}
              <View className="flex-row space-x-3 p-6 border-t border-gray-200">
                <TouchableOpacity
                  onPress={onClose}
                  className="flex-1 bg-gray-100 py-3 rounded-lg"
                >
                  <Text className="text-gray-700 font-medium text-center">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading}
                  className={`flex-1 py-3 rounded-lg ${
                    loading ? 'bg-gray-300' : 'bg-primary-500'
                  }`}
                >
                  <Text className="text-white font-medium text-center">
                    {loading ? 'Creating...' : 'Create Order'}
                  </Text>
                </TouchableOpacity>
              </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
