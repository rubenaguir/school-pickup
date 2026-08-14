import React from 'react';

export interface ToggleProps {
  /** @startingPoint section="Core" subtitle="Interruptor on/off, coral activo" viewport="300x100" */
  checked: boolean;
  onChange?: (next: boolean) => void;
}

export declare function Toggle(props: ToggleProps): JSX.Element;
