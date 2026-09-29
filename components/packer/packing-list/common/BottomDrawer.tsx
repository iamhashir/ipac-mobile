import React, { useRef } from 'react';
import { Modal, TouchableOpacity, View, Text, useWindowDimensions, PanResponder, Animated } from 'react-native';

interface BottomDrawerProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const BottomDrawer: React.FC<BottomDrawerProps> = ({ visible, onClose, title, children }) => {
  const { height } = useWindowDimensions();
  const panY = useRef(new Animated.Value(0)).current;

  const resetPositionAnim = Animated.timing(panY, {
    toValue: 0,
    duration: 300,
    useNativeDriver: true,
  });

  const closeAnim = Animated.timing(panY, {
    toValue: height,
    duration: 300,
    useNativeDriver: true,
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderMove: (e, gs) => {
        if (gs.dy > 0) {
          panY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (e, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          closeAnim.start(() => {
            onClose();
            panY.setValue(0);
          });
        } else {
          resetPositionAnim.start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        className="flex-1 bg-black/40 justify-end"
        onPress={onClose}
      >
        <Animated.View
          style={{ transform: [{ translateY: panY }] }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(event) => event.stopPropagation()}
            className="bg-white rounded-t-2xl px-4 pt-3 pb-4"
            style={{ maxHeight: Math.max(360, height * 0.88) }}
          >
            <View {...panResponder.panHandlers} className="w-full pb-2 pt-1 items-center justify-center">
              <TouchableOpacity onPress={onClose} className="py-2 px-4">
                <View className="w-12 h-1.5 rounded-full bg-gray-300" />
              </TouchableOpacity>
            </View>

            {title ? (
              <Text className="text-lg font-semibold text-gray-800 mb-3 px-2">
                {title}
              </Text>
            ) : null}

            {children}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

export default BottomDrawer;
