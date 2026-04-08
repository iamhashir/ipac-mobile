import React from 'react';
import AccessoriesSection from '../section_09_accessories/AccessoriesSection';

interface SecuringSectionProps {
  orderPackageId: string;
  hideUseButton?: boolean;
  hideRemoveButton?: boolean;
  editable?: boolean;
}

const SecuringSection: React.FC<SecuringSectionProps> = (props) => (
  <AccessoriesSection
    {...props}
    title="Securing"
    variantTag="securing"
    materialType="Securing"
    addModalAutoTag="Securing"
    mediaDesignation="securing"
    itemLabel="Securing"
  />
);

export default SecuringSection;
