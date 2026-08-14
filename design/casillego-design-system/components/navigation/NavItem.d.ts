import React from 'react';

export interface NavItemProps {
  /** @startingPoint section="Navigation" subtitle="Ítem de sidebar oscuro, activo en coral" viewport="400x100" */
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}

export declare function NavItem(props: NavItemProps): JSX.Element;
