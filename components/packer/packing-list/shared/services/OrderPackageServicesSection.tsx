import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { db } from "../../../../../utils/api/supabase";
import { Trash2, Plus, X, Camera, Check, ChevronDown } from "lucide-react-native";

interface Service {
  id: string;
  service: string;
  ui_code: string;
}

interface OrderPackageService {
  id: string;
  service_id: string;
  result: any;
  service: {
    service: string;
    ui_code: string;
  };
}

interface OrderPackageServicesSectionProps {
  orderPackageId: string;
  tag: string; // e.g. "Vacuum Packing" or "Gas Packing"
  title?: string;
  editable?: boolean;
}

const OrderPackageServicesSection: React.FC<OrderPackageServicesSectionProps> = ({
  orderPackageId,
  tag,
  title = "Services",
  editable = true,
}) => {
  const [services, setServices] = useState<Service[]>([]);
  const [addedServices, setAddedServices] = useState<OrderPackageService[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [humidity, setHumidity] = useState("");
  const [temperature, setTemperature] = useState("");
  const [oxygen, setOxygen] = useState("");
  const [photos, setPhotos] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadData();
  }, [orderPackageId, tag]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load available services for this tag
      const { data: servicesData, error: servicesError } = await db.getServicesByTag(tag);
      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      // Load added services for this order package
      const { data: addedData, error: addedError } = await db.getOrderPackageServices(orderPackageId);
      if (addedError) throw addedError;
      
      // Filter added services to only show ones relevant to this section's tag
      // We rely on the servicesData which we just fetched by tag.
      const relevantServiceIds = new Set((servicesData || []).map(s => s.id));
      const filteredAdded = (addedData || []).filter(item => relevantServiceIds.has(item.service_id));
      
      setAddedServices(filteredAdded);
    } catch (error) {
      console.error("Error loading services:", error);
      Alert.alert("Error", "Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async () => {
    if (!selectedService) return;

    // Validation
    if (selectedService.ui_code === "hum/temp") {
      if (!humidity || !temperature) {
        Alert.alert("Missing Fields", "Please enter both humidity and temperature.");
        return;
      }
      if (!photos["humidity"] || !photos["temperature"]) {
        Alert.alert("Missing Photos", "Please take photos for both humidity and temperature.");
        return;
      }
    } else if (selectedService.ui_code === "oxygen") {
      if (!oxygen) {
        Alert.alert("Missing Fields", "Please enter oxygen level.");
        return;
      }
      if (!photos["oxygen"]) {
        Alert.alert("Missing Photo", "Please take a photo for the oxygen level.");
        return;
      }
    }

    setLoading(true);
    try {
      // Upload photos
      const uploadedPhotos: { [key: string]: string } = {};
      for (const [key, uri] of Object.entries(photos)) {
        const { data: path, error: uploadError } = await db.uploadMediaToStorage(
          orderPackageId,
          uri,
          "service", // designation
          `${selectedService.service} - ${key}` // notes
        );
        if (uploadError) throw uploadError;
        if (path) uploadedPhotos[key] = path;
      }

      // Construct result JSON
      let result: any = {};
      if (selectedService.ui_code === "hum/temp") {
        result = {
          humidity: { value: humidity, photo: uploadedPhotos["humidity"] },
          temperature: { value: temperature, photo: uploadedPhotos["temperature"] },
        };
      } else if (selectedService.ui_code === "oxygen") {
        result = {
          oxygen: { value: oxygen, photo: uploadedPhotos["oxygen"] },
        };
      }

      // Save to DB
      const { error } = await db.addOrderPackageService(
        orderPackageId,
        selectedService.id,
        result,
        true // isFinal
      );

      if (error) throw error;

      setModalVisible(false);
      resetForm();
      loadData(); // Reload list
    } catch (error) {
      console.error("Error adding service:", error);
      Alert.alert("Error", "Failed to add service");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Delete Service", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await db.deleteOrderPackageService(id);
            if (error) throw error;
            loadData();
          } catch (error) {
            console.error("Error deleting service:", error);
            Alert.alert("Error", "Failed to delete service");
          }
        },
      },
    ]);
  };

  const pickImage = async (key: string) => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });

    if (!result.canceled) {
      setPhotos((prev) => ({ ...prev, [key]: result.assets[0].uri }));
    }
  };

  const resetForm = () => {
    setSelectedService(null);
    setHumidity("");
    setTemperature("");
    setOxygen("");
    setPhotos({});
  };

  const renderForm = () => {
    if (!selectedService) return null;

    if (selectedService.ui_code === "hum/temp") {
      return (
        <View className="space-y-4">
          <View>
            <Text className="text-gray-700 font-medium mb-1">Humidity (%)</Text>
            <View className="flex-row items-center space-x-2">
              <TextInput
                className="flex-1 border border-gray-300 rounded-lg p-3 bg-white"
                placeholder="Enter humidity"
                keyboardType="numeric"
                value={humidity}
                onChangeText={setHumidity}
              />
              <TouchableOpacity
                onPress={() => pickImage("humidity")}
                className={`p-3 rounded-lg ${photos["humidity"] ? "bg-green-100 border-green-500" : "bg-gray-100 border-gray-300"} border`}
              >
                <Camera size={24} color={photos["humidity"] ? "green" : "gray"} />
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text className="text-gray-700 font-medium mb-1">Temperature (°C)</Text>
            <View className="flex-row items-center space-x-2">
              <TextInput
                className="flex-1 border border-gray-300 rounded-lg p-3 bg-white"
                placeholder="Enter temperature"
                keyboardType="numeric"
                value={temperature}
                onChangeText={setTemperature}
              />
              <TouchableOpacity
                onPress={() => pickImage("temperature")}
                className={`p-3 rounded-lg ${photos["temperature"] ? "bg-green-100 border-green-500" : "bg-gray-100 border-gray-300"} border`}
              >
                <Camera size={24} color={photos["temperature"] ? "green" : "gray"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    } else if (selectedService.ui_code === "oxygen") {
      return (
        <View>
          <Text className="text-gray-700 font-medium mb-1">Oxygen Level (%)</Text>
          <View className="flex-row items-center space-x-2">
            <TextInput
              className="flex-1 border border-gray-300 rounded-lg p-3 bg-white"
              placeholder="Enter oxygen level"
              keyboardType="numeric"
              value={oxygen}
              onChangeText={setOxygen}
            />
            <TouchableOpacity
              onPress={() => pickImage("oxygen")}
              className={`p-3 rounded-lg ${photos["oxygen"] ? "bg-green-100 border-green-500" : "bg-gray-100 border-gray-300"} border`}
            >
              <Camera size={24} color={photos["oxygen"] ? "green" : "gray"} />
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return null;
  };

  return (
    <View className="mt-4">
      <View className="flex-row justify-between items-center mb-2 px-4">
        <Text className="text-lg font-bold text-gray-800">{title}</Text>
        {editable && (
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="bg-blue-600 px-3 py-2 rounded-lg flex-row items-center"
          >
            <Plus size={16} color="white" className="mr-1" />
            <Text className="text-white font-medium">Add Service</Text>
          </TouchableOpacity>
        )}
      </View>

      {addedServices.length === 0 ? (
        <View className="bg-gray-50 p-4 rounded-lg mx-4 border border-gray-200 items-center">
          <Text className="text-gray-500 italic">No services added yet</Text>
        </View>
      ) : (
        <View className="mx-4 space-y-2">
          {addedServices.map((item) => (
            <View
              key={item.id}
              className="bg-white p-3 rounded-lg border border-gray-200 flex-row justify-between items-center"
            >
              <View className="flex-1">
                <Text className="font-semibold text-gray-800">{item.service.service}</Text>
                <View className="mt-1">
                  {item.service.ui_code === "hum/temp" && (
                    <Text className="text-gray-600 text-sm">
                      Hum: {item.result.humidity?.value}% | Temp: {item.result.temperature?.value}°C
                    </Text>
                  )}
                  {item.service.ui_code === "oxygen" && (
                    <Text className="text-gray-600 text-sm">
                      Oxygen: {item.result.oxygen?.value}%
                    </Text>
                  )}
                </View>
              </View>
              {editable && (
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  className="p-2 bg-red-50 rounded-full"
                >
                  <Trash2 size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 h-[80%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">Add Service</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <X size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1">
              {!selectedService ? (
                <View className="space-y-3">
                  <Text className="text-gray-600 mb-2">Select a service to add:</Text>
                  {services.map((service) => (
                    <TouchableOpacity
                      key={service.id}
                      onPress={() => setSelectedService(service)}
                      className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex-row justify-between items-center"
                    >
                      <Text className="font-medium text-gray-800">{service.service}</Text>
                      <ChevronDown size={20} color="#9CA3AF" style={{ transform: [{ rotate: "-90deg" }] }} />
                    </TouchableOpacity>
                  ))}
                  {services.length === 0 && (
                    <Text className="text-center text-gray-500 mt-4">No services available for this section.</Text>
                  )}
                </View>
              ) : (
                <View className="space-y-6">
                  <View className="flex-row items-center mb-2">
                    <TouchableOpacity onPress={() => setSelectedService(null)} className="mr-2">
                       <Text className="text-blue-600">Change</Text>
                    </TouchableOpacity>
                    <Text className="text-lg font-semibold text-gray-800">{selectedService.service}</Text>
                  </View>
                  
                  {renderForm()}

                  <TouchableOpacity
                    onPress={handleAddService}
                    disabled={loading}
                    className={`mt-6 bg-blue-600 p-4 rounded-xl flex-row justify-center items-center ${loading ? "opacity-70" : ""}`}
                  >
                    {loading ? (
                      <Text className="text-white font-bold">Saving...</Text>
                    ) : (
                      <>
                        <Check size={20} color="white" className="mr-2" />
                        <Text className="text-white font-bold text-lg">Save Service</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default OrderPackageServicesSection;
