import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  TouchableWithoutFeedback,
} from 'react-native';
import { Send } from 'lucide-react-native';

interface RequestMoreModalProps {
  visible: boolean;
  itemName: string;
  /** Suggested starting delta (e.g. the shortfall the packer just hit). */
  suggestedDelta?: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (delta: number, reason: string) => void;
}

const RequestMoreModal: React.FC<RequestMoreModalProps> = ({
  visible,
  itemName,
  suggestedDelta,
  submitting,
  onClose,
  onSubmit,
}) => {
  const [delta, setDelta] = useState('1');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) {
      const s = suggestedDelta && suggestedDelta > 0 ? Math.ceil(suggestedDelta) : 1;
      setDelta(String(s));
      setReason('');
    }
  }, [visible, suggestedDelta]);

  const handleSend = () => {
    const n = Number(delta);
    if (!Number.isFinite(n) || n <= 0) return;
    onSubmit(n, reason.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 bg-black/45 justify-center px-36"
        onPress={() => !submitting && onClose()}
      >
        <TouchableWithoutFeedback>
          <View className="bg-white rounded-xl w-full overflow-hidden border-2 border-amber-300 shadow-xl">
            <View className="bg-amber-50 p-3 gap-2 border-b border-amber-100 flex-row items-center">
              <Send size={18} color="#d97706" />
              <Text className="text-base font-bold text-amber-900">Request more from admin</Text>
            </View>

            <View className="p-4">
              <Text className="font-semibold text-slate-800 text-sm mb-3">{itemName}</Text>

              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                How many MORE do you need?
              </Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 font-medium mb-3"
                value={delta}
                onChangeText={setDelta}
                keyboardType="numeric"
                editable={!submitting}
                autoFocus
              />

              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Reason (optional)
              </Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900"
                value={reason}
                onChangeText={setReason}
                placeholder="Why is more needed?"
                placeholderTextColor="#94a3b8"
                multiline
                editable={!submitting}
              />
            </View>

            <View className="p-3 bg-slate-50 border-t border-slate-100 flex-row justify-end gap-2">
              <TouchableOpacity
                onPress={onClose}
                className="px-5 py-2 rounded-lg bg-white border border-slate-200"
                disabled={submitting}
              >
                <Text className="text-slate-600 font-bold text-xs">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSend}
                className="px-6 py-2 rounded-lg bg-amber-600"
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-white font-bold text-xs">Send Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Pressable>
    </Modal>
  );
};

export default RequestMoreModal;
