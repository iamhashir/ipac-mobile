import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { db } from '../../../../../utils/api/supabase';

type Mode = 'edit' | 'confirm';

interface AllocCtx {
  orderId: string | null;
  itemsDbId: string | null;
  destination: string | null;
  expected: number | null;
  packed: number;
  remaining: number | null;
}

interface QtyAllocationModalProps {
  visible: boolean;
  /** The pkd_item row being edited/confirmed (carries id, quantity, item_details). */
  item: any | null;
  /** 'edit' sets the row quantity; 'confirm' flips a planned shadow to packed. */
  mode: Mode;
  /** Origin box — recorded on a "request more" so the admin sees where it came from. */
  orderPackageId: string;
  onClose: () => void;
  /** Called after a successful save/confirm so the caller can reload its list. */
  onSaved: () => void;
}

/**
 * Compact quantity pop-up shown as `[ input ] / max`. The max is this destination's
 * remaining allocation headroom. When the typed amount is within the max the primary
 * button saves (mode 'edit' -> updatePkdItemQuantity) or confirms (mode 'confirm' ->
 * confirmPackedItem). When it EXCEEDS the max the button morphs into "Request N extra",
 * filing an allocation-increase request the admin approves in the web panel.
 *
 * Shared by the box-item QTY cell (edit) and the CONFIRM PACKED button (confirm) so the
 * remaining/max display + request-more flow live in exactly one place.
 */
export default function QtyAllocationModal({
  visible,
  item,
  mode,
  orderPackageId,
  onClose,
  onSaved,
}: QtyAllocationModalProps) {
  const [qty, setQty] = useState('1');
  const [ctx, setCtx] = useState<AllocCtx | null>(null);
  const [busy, setBusy] = useState(false);
  // True while the per-destination max is being fetched. We hold the primary action
  // until it resolves so the over-cap "request more" morph can never be skipped by a
  // fast tap before the cap is known.
  const [ctxLoading, setCtxLoading] = useState(false);

  // Seed the input and fetch this destination's allocation each time the modal opens.
  useEffect(() => {
    if (!visible || !item) return;
    setQty(String(item?.quantity ?? 1));
    setCtx(null);
    setCtxLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const { data } = await db.getPkdAllocationContext(item.id);
        if (!cancelled && data) {
          setCtx({
            orderId: data.orderId ?? null,
            itemsDbId: data.itemsDbId ?? null,
            destination: data.destination ?? null,
            expected: data.expected ?? null,
            packed: Number(data.packed ?? 0),
            remaining: data.remaining ?? null,
          });
        }
      } catch (e) {
        console.warn('Could not load allocation context for qty modal:', e);
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, item]);

  const isConfirm = mode === 'confirm';
  const qtyNum = Math.round(Number(qty));
  const remaining = ctx?.remaining ?? null;
  // Over the max only when we actually know the cap (remaining !== null).
  const overCap = remaining !== null && Number.isFinite(qtyNum) && qtyNum > remaining;
  const extra = overCap ? qtyNum - (remaining as number) : 0;

  const handlePrimary = async () => {
    if (!item) return;
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      Alert.alert('Invalid quantity', 'Enter a whole number greater than 0.');
      return;
    }
    setBusy(true);
    try {
      const { error } = isConfirm
        ? await db.confirmPackedItem(item.id, qtyNum)
        : await db.updatePkdItemQuantity(item.id, qtyNum);
      if (error) {
        Alert.alert('Could not save', (error as any)?.message || 'Failed to save quantity.');
        return;
      }
      onClose();
      onSaved();
    } catch (e) {
      console.error('Qty modal save error:', e);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequest = async () => {
    if (!item || !ctx) return;
    if (!ctx.orderId || !ctx.itemsDbId) {
      Alert.alert('Cannot request', 'This item has no allocation to raise for this destination.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await db.createAllocationIncreaseRequest({
        orderId: ctx.orderId,
        itemsDbId: ctx.itemsDbId,
        destination: ctx.destination,
        requestedDelta: extra,
        orderPackageId,
      });
      if (error) {
        Alert.alert('Request failed', (error as any)?.message || 'Could not send the request.');
        return;
      }
      Alert.alert(
        'Request sent',
        `Asked the admin for ${extra} more for ${ctx.destination || 'this destination'}. ` +
          `Once approved you can set the full ${qtyNum}.`,
      );
      onClose();
    } catch (e) {
      console.error('Qty modal request error:', e);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => !busy && onClose()}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.45)',
            justifyContent: 'center',
            paddingHorizontal: 40,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 80}
            style={{ width: '100%' }}
          >
            <View
              className={`bg-white rounded-xl w-full overflow-hidden border-2 shadow-xl ${
                isConfirm ? 'border-amber-300' : 'border-blue-300'
              }`}
            >
              <View
                className={`p-3 border-b ${
                  isConfirm ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'
                }`}
              >
                <Text
                  className={`text-base font-bold ${
                    isConfirm ? 'text-amber-900' : 'text-blue-900'
                  }`}
                >
                  {isConfirm ? 'Confirm item packed' : 'Set quantity'}
                </Text>
              </View>

              <View className="p-4">
                <Text className="text-sm font-semibold text-slate-800 mb-3" numberOfLines={2}>
                  {item?.item_details?.description || 'Selected item'}
                </Text>

                {/* [ input ] / max */}
                <View className="flex-row items-center justify-center">
                  <TextInput
                    disableFullscreenUI
                    className={`text-center text-2xl font-bold text-slate-900 bg-slate-50 border-2 rounded-lg px-3 py-2 w-24 ${
                      overCap ? 'border-blue-500' : 'border-slate-300'
                    }`}
                    value={qty}
                    onChangeText={setQty}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    editable={!busy}
                    autoFocus
                  />
                  <Text className="text-2xl font-bold text-slate-300 mx-3">/</Text>
                  <Text className="text-2xl font-bold text-slate-500 w-16">
                    {ctxLoading ? '…' : remaining !== null ? remaining : '—'}
                  </Text>
                </View>
                <Text className="text-[11px] text-slate-500 text-center mt-2">
                  {ctx?.destination ? `${ctx.destination} · ` : ''}
                  {remaining !== null ? 'max available to pack here' : 'no per-destination cap'}
                </Text>
                {overCap && (
                  <Text className="text-[11px] text-blue-700 text-center mt-2 font-semibold">
                    {extra} over the max — request the extra from the admin.
                  </Text>
                )}
              </View>

              <View
                className="p-3 bg-slate-50 border-t border-slate-100 flex-row justify-end"
                style={{ gap: 8 }}
              >
                <TouchableOpacity
                  onPress={onClose}
                  className="px-5 py-2 rounded-lg bg-white border border-slate-200"
                  disabled={busy}
                >
                  <Text className="text-slate-600 font-bold text-xs">Cancel</Text>
                </TouchableOpacity>
                {overCap ? (
                  <TouchableOpacity
                    onPress={handleRequest}
                    className="px-6 py-2 rounded-lg bg-blue-600"
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text className="text-white font-bold text-xs">Request {extra} extra</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handlePrimary}
                    className={`px-6 py-2 rounded-lg ${
                      busy || ctxLoading ? 'bg-slate-300' : isConfirm ? 'bg-amber-500' : 'bg-blue-600'
                    }`}
                    disabled={busy || ctxLoading}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text className="text-white font-bold text-xs">
                        {isConfirm ? 'Confirm packed' : 'Save'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
