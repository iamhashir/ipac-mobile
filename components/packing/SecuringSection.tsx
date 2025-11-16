import React from 'react';
import AccessoriesSection from './AccessoriesSection';

interface SecuringSectionProps {
  orderPackageId: string;
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
