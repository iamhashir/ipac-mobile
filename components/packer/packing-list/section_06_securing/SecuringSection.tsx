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

// Memoized: parent packing-list rebuilds tab JSX on every pkgInfoMap change;
// props here are primitives, so memo skips re-rendering the whole section.
export default React.memo(SecuringSection);
