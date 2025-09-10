import React from 'react';
import { View, Dimensions } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { cn } from '../../utils/cn';

const screenWidth = Dimensions.get('window').width;

export interface ChartConfig {
  [key: string]: {
    label?: string;
    color?: string;
  };
}

interface ChartContainerProps {
  className?: string;
  children: React.ReactNode;
  config: ChartConfig;
}

export function ChartContainer({ className, children, config }: ChartContainerProps) {
  return (
    <View className={cn("p-4", className)}>
      {children}
    </View>
  );
}

interface OrdersLineChartProps {
  data: {
    labels: string[];
    datasets: Array<{
      data: number[];
      color?: (opacity?: number) => string;
      strokeWidth?: number;
    }>;
  };
  className?: string;
}

export function OrdersLineChart({ data, className }: OrdersLineChartProps) {
  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: "#3b82f6"
    }
  };

  return (
    <View className={cn("", className)}>
      <LineChart
        data={data}
        width={screenWidth - 32} // Adjust for padding
        height={220}
        yAxisLabel=""
        yAxisSuffix=""
        chartConfig={chartConfig}
        bezier
        style={{
          marginVertical: 8,
          borderRadius: 16,
        }}
      />
    </View>
  );
}

interface OrdersBarChartProps {
  data: {
    labels: string[];
    datasets: Array<{
      data: number[];
    }>;
  };
  className?: string;
}

export function OrdersBarChart({ data, className }: OrdersBarChartProps) {
  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16
    }
  };

  return (
    <View className={cn("", className)}>
      <BarChart
        data={data}
        width={screenWidth - 32}
        height={220}
        yAxisLabel=""
        yAxisSuffix=""
        chartConfig={chartConfig}
        style={{
          marginVertical: 8,
          borderRadius: 16,
        }}
      />
    </View>
  );
}
