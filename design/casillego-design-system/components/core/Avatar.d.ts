import React from 'react';

export interface AvatarProps {
  /** @startingPoint section="Core" subtitle="Iniciales con acento rotativo" viewport="500x100" */
  name: string;
  index?: number;
  size?: number;
}

export declare function Avatar(props: AvatarProps): JSX.Element;
