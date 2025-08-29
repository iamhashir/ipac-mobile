import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';

interface CollapsibleCardProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  containerClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  children,
  defaultOpen = true,
  containerClassName = '',
  headerClassName = '',
  contentClassName = '',
}) => {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  return (
    <View className={`rounded-xl border ${containerClassName}`}>
      <TouchableOpacity
        className={`flex-row items-center justify-between px-3 py-2 ${headerClassName}`}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text className="text-gray-800 font-semibold">{title}</Text>
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
