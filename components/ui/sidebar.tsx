import React, { createContext, useContext, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { cn } from '../../utils/cn';

interface SidebarContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}

interface SidebarProviderProps {
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function SidebarProvider({ defaultOpen = true, children }: SidebarProviderProps) {
  const [open, setOpen] = useState(defaultOpen);
  
  const toggleSidebar = () => {
    setOpen(!open);
  };

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggleSidebar }}>
      <View className="flex-1 flex-row">
        {children}
      </View>
    </SidebarContext.Provider>
  );
}

interface SidebarProps {
  className?: string;
  children: React.ReactNode;
}

export function Sidebar({ className, children }: SidebarProps) {
  const { open } = useSidebar();

  if (!open) return null;

  return (
    <View className={cn("bg-white w-64 border-r border-gray-200", className)}>
      {children}
    </View>
  );
}

export function SidebarHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <View className={cn("p-6 border-b border-gray-200", className)}>
      {children}
    </View>
  );
}

export function SidebarContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <ScrollView className={cn("flex-1 p-4", className)}>
      {children}
    </ScrollView>
  );
}

export function SidebarFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <View className={cn("p-4 border-t border-gray-200", className)}>
      {children}
    </View>
  );
}

export function SidebarMenu({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <View className={cn("space-y-2", className)}>
      {children}
    </View>
  );
}

export function SidebarMenuItem({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <View className={cn("", className)}>
      {children}
    </View>
  );
}

interface SidebarMenuButtonProps {
  className?: string;
  isActive?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}

export function SidebarMenuButton({ className, isActive, onPress, children }: SidebarMenuButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={cn(
        "flex-row items-center px-4 py-3 rounded-lg transition-colors",
        isActive ? "bg-primary-50 border-l-4 border-primary-500" : "hover:bg-gray-100",
        className
      )}
    >
      {children}
    </TouchableOpacity>
  );
}

export function SidebarInset({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <View className={cn("flex-1 bg-gray-50", className)}>
      {children}
    </View>
  );
}
