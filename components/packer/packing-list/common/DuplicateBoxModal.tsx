import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Copy, X } from 'lucide-react-native';
import { db } from '../../../../utils/api/supabase';

export interface DuplicateBoxResult {
  newInstanceId: string;
  instanceNumber: number;
  ipacReference: string | null;
}

interface DuplicateBoxModalProps {
  visible: boolean;
  /** Display label shown in the title, e.g. "1.2" or "Box #3 - Instance 2" */
  boxLabel: string;
  /** The source order_pkg_instance.id to duplicate */
  sourceInstanceId: string;
  onClose: () => void;
  /** Called after a successful duplicate; parent should refresh the list */
  onSuccess: (result: DuplicateBoxResult) => void;
}

const DuplicateBoxModal: React.FC<DuplicateBoxModalProps> = ({
  visible,
  boxLabel,
  sourceInstanceId,
  onClose,
  onSuccess,
}) => {
  const [includeFinalValues, setIncludeFinalValues] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setIncludeFinalValues(false);
    setLoading(false);
    setError(null);
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleDuplicate = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: dupErr } = await db.duplicateBoxInstance(sourceInstanceId, {
        includeFinalValues,
      });
      if (dupErr) {
        setError(dupErr?.message || 'Failed to duplicate box.');
        return;
      }
      if (!data) {
        setError('No data returned from duplicate operation.');
        return;
      }
      reset();
      onSuccess(data);
    } catch (e: any) {
      setError(e?.message || 'Unexpected error while duplicating box.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      {/* Translucent scrim */}
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        activeOpacity={1}
        onPress={handleClose}
      >
        {/* Card — stop press propagation so taps inside don't close */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 480,
              backgroundColor: '#eff6ff', // bg-blue-50
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#bfdbfe', // blue-200
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#bfdbfe',
                backgroundColor: '#dbeafe', // blue-100
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Copy size={20} color="#1d4ed8" />
                <Text
                  style={{
                    marginLeft: 10,
                    fontSize: 17,
                    fontWeight: '700',
                    color: '#1e3a8a',
                    flexShrink: 1,
                  }}
                  numberOfLines={2}
                >
                  Duplicate box {boxLabel}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                disabled={loading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 12 }}
              >
                <X size={22} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 18 }}>
              {/* Toggle row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#ffffff',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  minHeight: 48,
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af' }}>
                    Also copy final / packed values
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                    {includeFinalValues
                      ? 'ON — clones confirmed packed items (capped to remaining allocation)'
                      : 'OFF — fresh box with the same plan, nothing packed yet'}
                  </Text>
                </View>
                <Switch
                  value={includeFinalValues}
                  onValueChange={(v) => setIncludeFinalValues(v)}
                  trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                  thumbColor={includeFinalValues ? '#ffffff' : '#f3f4f6'}
                  disabled={loading}
                />
              </View>

              {/* Info note */}
              <View
                style={{
                  marginTop: 14,
                  backgroundColor: '#f0fdf4',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#bbf7d0',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ fontSize: 12, color: '#166534' }}>
                  A new sibling instance will be created under the same box
                  package, with a fresh unique IPAC reference. Package dimensions
                  and securing are shared (not duplicated).
                </Text>
              </View>

              {/* Error message */}
              {!!error && (
                <View
                  style={{
                    marginTop: 12,
                    backgroundColor: '#fef2f2',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#fecaca',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ fontSize: 13, color: '#b91c1c' }}>{error}</Text>
                </View>
              )}
            </View>

            {/* Footer actions */}
            <View
              style={{
                flexDirection: 'row',
                borderTopWidth: 1,
                borderTopColor: '#bfdbfe',
              }}
            >
              <TouchableOpacity
                onPress={handleClose}
                disabled={loading}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  alignItems: 'center',
                  backgroundColor: '#ffffff',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <View style={{ width: 1, backgroundColor: '#bfdbfe' }} />

              <TouchableOpacity
                onPress={handleDuplicate}
                disabled={loading}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  alignItems: 'center',
                  backgroundColor: loading ? '#93c5fd' : '#2563eb',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  minHeight: 48,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Copy size={16} color="#ffffff" />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: '#ffffff',
                        marginLeft: 6,
                      }}
                    >
                      Duplicate
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default DuplicateBoxModal;
