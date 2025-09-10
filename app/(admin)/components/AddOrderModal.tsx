import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native';
import { X } from 'lucide-react-native';
import { supabase } from '../../../utils/api/supabase';
import { useAuth } from '../../../utils/AuthContext';

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

  const handleSubmit = async () => {
    if (!orderName.trim() || !selectedClientId) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .insert({
          order_name: orderName.trim(),
          description: description.trim() || null,
          total_estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
          client_id: selectedClientId,
          created_by: user?.id,
          commercial_status: 'draft',
          production_status: 'pending'
        });

      if (error) throw error;

      // Reset form
      setOrderName('');
      setDescription('');
      setEstimatedCost('');
      setSelectedClientId('');
      
      onOrderAdded();
      onClose();
      Alert.alert('Success', 'Order created successfully');
    } catch (error) {
      console.error('Error creating order:', error);
      Alert.alert('Error', 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        <View className="bg-white rounded-xl w-full max-w-md max-h-5/6">
          {/* Header */}
          <View className="flex-row justify-between items-center p-6 border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-900">Add New Order</Text>
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
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Client *
              </Text>
              <ScrollView className="max-h-32 border border-gray-300 rounded-lg">
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
        </View>
      </View>
    </Modal>
  );
}
