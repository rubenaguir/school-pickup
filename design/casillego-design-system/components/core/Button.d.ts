import React from 'react';

export interface ButtonProps {
  /** @startingPoint section="Core" subtitle="Primary / outline / ghost / destructive" viewport="700x120" */
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  full?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export declare function Button(props: ButtonProps): JSX.Element;
