import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

export interface DropdownAnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnchoredDropdownOption {
  key: string;
  label: string;
  badge?: string;
}

interface AnchoredSearchDropdownProps {
  visible: boolean;
  anchorRect: DropdownAnchorRect | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchPlaceholder: string;
  options: AnchoredDropdownOption[];
  emptyText?: string;
  maxHeight?: number;
  minWidth?: number;
  onSelect: (option: AnchoredDropdownOption) => void;
  onClose: () => void;
  footerAction?: {
    label: string;
    onPress: () => void;
  };
}

const SCREEN_GAP = 8;
const ANCHOR_GAP = 6;

const AnchoredSearchDropdown: React.FC<AnchoredSearchDropdownProps> = ({
  visible,
  anchorRect,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  options,
  emptyText = 'No options found.',
  maxHeight = 320,
  minWidth = 280,
  onSelect,
  onClose,
  footerAction,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const layout = useMemo(() => {
    const anchor = anchorRect ?? {
      x: SCREEN_GAP,
      y: 120,
      width: minWidth,
      height: 40,
    };

    const desiredWidth = Math.max(minWidth, Math.round(anchor.width));
    const panelWidth = Math.min(desiredWidth, screenWidth - SCREEN_GAP * 2);

    const left = Math.min(
      Math.max(SCREEN_GAP, Math.round(anchor.x)),
      Math.max(SCREEN_GAP, screenWidth - panelWidth - SCREEN_GAP)
    );

    const spaceBelow = screenHeight - (anchor.y + anchor.height) - SCREEN_GAP;
    const spaceAbove = anchor.y - SCREEN_GAP;
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;

    const availableHeight = Math.max(
      140,
      openUpward ? spaceAbove - ANCHOR_GAP : spaceBelow - ANCHOR_GAP
    );
    const panelHeight = Math.min(maxHeight, availableHeight);

    const top = openUpward
      ? Math.max(SCREEN_GAP, Math.round(anchor.y - panelHeight - ANCHOR_GAP))
      : Math.min(
          screenHeight - panelHeight - SCREEN_GAP,
          Math.round(anchor.y + anchor.height + ANCHOR_GAP)
        );

    return {
      left,
      top,
      panelWidth,
      panelHeight,
    };
  }, [anchorRect, maxHeight, minWidth, screenHeight, screenWidth]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1 }}>
        <View pointerEvents="box-none" style={{ flex: 1 }}>
          <Pressable
            onPress={() => {
              // Consume touch events inside dropdown panel.
            }}
            style={{
              position: 'absolute',
              left: layout.left,
              top: layout.top,
              width: layout.panelWidth,
              maxHeight: layout.panelHeight,
            }}
          >
            <View className="border border-blue-300 rounded bg-white overflow-hidden">
              <View className="p-2 border-b border-gray-200">
                <TextInput
                  value={searchQuery}
                  onChangeText={onSearchQueryChange}
                  placeholder={searchPlaceholder}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                  returnKeyType="done"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: layout.panelHeight - 70 }}>
                {options.length === 0 ? (
                  <View className="px-3 py-4">
                    <Text className="text-gray-500 text-sm text-center">{emptyText}</Text>
                  </View>
                ) : (
                  options.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => onSelect(opt)}
                      className="px-3 py-2 border-b border-gray-100"
                    >
                      <View className="flex-row justify-between items-center">
                        <Text className="text-gray-800">{opt.label}</Text>
                        {opt.badge ? (
                          <View className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            <Text className="text-[10px] text-slate-700">{opt.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              {footerAction ? (
                <View className="p-2 border-t border-gray-300">
                  <TouchableOpacity
                    onPress={footerAction.onPress}
                    className="bg-blue-50 border border-blue-500 rounded px-3 py-2"
                  >
                    <Text className="text-blue-700 text-center font-medium text-sm">{footerAction.label}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

export default AnchoredSearchDropdown;
