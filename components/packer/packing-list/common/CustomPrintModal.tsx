import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { X, Printer, Eye, Type } from 'lucide-react-native';

interface CustomPrintModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  initialText: string;
  onPrint: (text: string) => Promise<void>;
  onPreview: (text: string) => Promise<void>;
}

const CustomPrintModal: React.FC<CustomPrintModalProps> = ({ 
  visible, 
  onClose, 
  title, 
  subtitle,
  initialText, 
  onPrint, 
  onPreview 
}) => {
  const [text, setText] = useState(initialText);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    if (visible) {
      setText(initialText);
    }
  }, [visible, initialText]);

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      await onPrint(text);
      onClose();
    } catch (e) {
      // Error handled by parent
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePreview = async () => {
    try {
      setIsPreviewing(true);
      await onPreview(text);
    } catch (e) {
      // Error handled by parent
    } finally {
      setIsPreviewing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center' }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 80}
            style={{ width: '100%', paddingHorizontal: 24 }}
          >
            <View className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center">
                  <View className="bg-blue-50 p-2 rounded-lg mr-3">
                    <Type size={20} color="#2563eb" />
                  </View>
                  <View>
                    <Text className="text-xl font-bold text-slate-900">{title}</Text>
                    {subtitle && <Text className="text-xs text-slate-500">{subtitle}</Text>}
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} className="p-1">
                  <X size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View className="mb-6">
                <Text className="text-sm font-semibold text-slate-700 mb-2">Label Text</Text>
                <TextInput
                  className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900 bg-slate-50 text-base"
                  placeholder="Type what needs to be printed..."
                  value={text}
                  onChangeText={setText}
                  multiline
                  numberOfLines={2}
                  autoFocus
                />
                <Text className="text-[10px] text-slate-400 mt-2">
                  * This text will appear next to the QR code on the label.
                </Text>
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handlePreview}
                  disabled={isPreviewing || isPrinting}
                  className="flex-1 bg-slate-100 py-3.5 rounded-xl flex-row items-center justify-center border border-slate-200"
                >
                  {isPreviewing ? (
                    <ActivityIndicator size="small" color="#475569" />
                  ) : (
                    <>
                      <Eye size={18} color="#475569" className="mr-2" />
                      <Text className="text-slate-700 font-bold">Preview</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlePrint}
                  disabled={isPrinting || isPreviewing}
                  className="flex-1 bg-teal-600 py-3.5 rounded-xl flex-row items-center justify-center shadow-sm shadow-teal-200"
                >
                  {isPrinting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Printer size={18} color="#ffffff" className="mr-2" />
                      <Text className="text-white font-bold">Direct Print</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default CustomPrintModal;
