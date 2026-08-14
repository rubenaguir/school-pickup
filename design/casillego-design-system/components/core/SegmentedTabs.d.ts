import React from 'react';

export interface SegmentedTabsProps {
  /** @startingPoint section="Core" subtitle="Filtro tipo pastilla, activo en navy" viewport="500x100" */
  options: string[];
  value: string;
  onChange?: (next: string) => void;
}

export declare function SegmentedTabs(props: SegmentedTabsProps): JSX.Element;
