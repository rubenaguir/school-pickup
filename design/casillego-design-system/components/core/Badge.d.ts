import React from 'react';

export interface BadgeProps {
  /** @startingPoint section="Core" subtitle="Los 5 estados de recogida + neutro/marca" viewport="700x120" */
  tone?: 'en-route' | 'arriving' | 'arrived' | 'delivered' | 'cancelled' | 'brand' | 'neutral';
  dot?: boolean;
  children: React.ReactNode;
}

export declare function Badge(props: BadgeProps): JSX.Element;
