import React from 'react';
import { View } from 'react-native';
import TwoTierInfoCard from './common/TwoTierInfoCard';
import GroupBox from './common/GroupBox';
import CollapsibleCard from './common/CollapsibleCard';

export interface TwoTier<T> { original: T | null | undefined; final: T | null | undefined; }

export interface TopRowValues { quantity: any; type: any; thickness: any; }
export interface BarsValues { quantity: any; type: any; space: any; width: any; thickness: any; }
export interface SkidsValues { quantity: any; type: any; thickness: any; }

export interface SectionValues {
  top?: TwoTier<TopRowValues>;
  horizontalBars?: TwoTier<BarsValues>;
  verticalBars?: TwoTier<BarsValues>;
  skids?: TwoTier<SkidsValues>; // only for Base
}

export interface OrderComponentsSectionProps {
  data?: {
    bigSides?: SectionValues;
    smallSides?: SectionValues;
    lid?: SectionValues;
    base?: SectionValues;
  };
}

const smallWidth = 160;
const typeWideWidth = 240;

const SectionPanel: React.FC<{ data?: SectionValues; includeSkids?: boolean }>
  = ({ data, includeSkids }) => {
  return (
    <View className="p-4">
      {/* Top row: Quantity | Type (wider) | Thickness */}
      <View className="flex-row flex-wrap">
        <TwoTierInfoCard
          label="Quantity"
          original={data?.top?.original?.quantity ?? null}
          final={data?.top?.final?.quantity ?? null}
          width={smallWidth}
        />
        <TwoTierInfoCard
          label="Type"
          original={data?.top?.original?.type ?? null}
          final={data?.top?.final?.type ?? null}
          width={typeWideWidth}
        />
        <TwoTierInfoCard
          label="Thickness"
          original={data?.top?.original?.thickness ?? null}
          final={data?.top?.final?.thickness ?? null}
          width={smallWidth}
        />
      </View>

      {/* Horizontal Bars */}
      <GroupBox title="Horizontal bars">
        <View className="flex-row flex-wrap">
          <TwoTierInfoCard label="Quantity" original={data?.horizontalBars?.original?.quantity ?? null} final={data?.horizontalBars?.final?.quantity ?? null} width={smallWidth} />
          <TwoTierInfoCard label="Type" original={data?.horizontalBars?.original?.type ?? null} final={data?.horizontalBars?.final?.type ?? null} width={smallWidth} />
          <TwoTierInfoCard label="Space" original={data?.horizontalBars?.original?.space ?? null} final={data?.horizontalBars?.final?.space ?? null} width={smallWidth} />
          <TwoTierInfoCard label="Width" original={data?.horizontalBars?.original?.width ?? null} final={data?.horizontalBars?.final?.width ?? null} width={smallWidth} />
          <TwoTierInfoCard label="Thickness" original={data?.horizontalBars?.original?.thickness ?? null} final={data?.horizontalBars?.final?.thickness ?? null} width={smallWidth} />
        </View>
      </GroupBox>

      {/* Vertical Bars */}
      <GroupBox title="Vertical bars">
        <View className="flex-row flex-wrap">
          <TwoTierInfoCard label="Quantity" original={data?.verticalBars?.original?.quantity ?? null} final={data?.verticalBars?.final?.quantity ?? null} width={smallWidth} />
          <TwoTierInfoCard label="Type" original={data?.verticalBars?.original?.type ?? null} final={data?.verticalBars?.final?.type ?? null} width={smallWidth} />
          <TwoTierInfoCard label="Space" original={data?.verticalBars?.original?.space ?? null} final={data?.verticalBars?.final?.space ?? null} width={smallWidth} />
          <TwoTierInfoCard label="Width" original={data?.verticalBars?.original?.width ?? null} final={data?.verticalBars?.final?.width ?? null} width={smallWidth} />
          <TwoTierInfoCard label="Thickness" original={data?.verticalBars?.original?.thickness ?? null} final={data?.verticalBars?.final?.thickness ?? null} width={smallWidth} />
        </View>
      </GroupBox>

      {/* Skids (Base only) */}
      {includeSkids && (
        <GroupBox title="Skids">
          <View className="flex-row flex-wrap">
            <TwoTierInfoCard label="Quantity" original={data?.skids?.original?.quantity ?? null} final={data?.skids?.final?.quantity ?? null} width={smallWidth} />
            <TwoTierInfoCard label="Type" original={data?.skids?.original?.type ?? null} final={data?.skids?.final?.type ?? null} width={smallWidth} />
            <TwoTierInfoCard label="Thickness" original={data?.skids?.original?.thickness ?? null} final={data?.skids?.final?.thickness ?? null} width={smallWidth} />
          </View>
        </GroupBox>
      )}
    </View>
  );
};

const OrderComponentsSection: React.FC<OrderComponentsSectionProps> = ({ data }) => {
  return (
    <View className="mt-2 mb-6">
      <CollapsibleCard title="Big sides" containerClassName="bg-white border-gray-400 mx-4 mb-4" defaultOpen>
        <SectionPanel data={data?.bigSides} />
      </CollapsibleCard>
      <CollapsibleCard title="Small sides" containerClassName="bg-white border-gray-400 mx-4 mb-4" defaultOpen>
        <SectionPanel data={data?.smallSides} />
      </CollapsibleCard>
      <CollapsibleCard title="Lid" containerClassName="bg-white border-gray-400 mx-4 mb-4" defaultOpen>
        <SectionPanel data={data?.lid} />
      </CollapsibleCard>
      <CollapsibleCard title="Base" containerClassName="bg-white border-gray-400 mx-4 mb-2" defaultOpen>
        <SectionPanel data={data?.base} includeSkids />
      </CollapsibleCard>
    </View>
  );
};

export default OrderComponentsSection;
