import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';

interface CollapsibleCardProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  containerClassName?: string;
  titleClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  children,
  defaultOpen = true,
  containerClassName = '',
  titleClassName = '',
  headerClassName = '',
  contentClassName = '',
}) => {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  return (
    <View className={`rounded-xl border ${containerClassName}`}>
      <TouchableOpacity
        className={`flex-row items-center justify-between px-3 ${open ? "pb-2 pt-4" : "py-6"} ${headerClassName}`}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text className={`text-gray-800 ${titleClassName ? titleClassName : "font-semibold"}`}>{title}</Text>
        {open ? <ChevronDown size={18} color="#374151" /> : <ChevronRight size={18} color="#374151" />}
      </TouchableOpacity>

      {open && (
        <View className={`px-3 pb-3 ${contentClassName}`}>
          {children}
        </View>
      )}
    </View>
  );
};

export default CollapsibleCard;
