import React from 'react';

export interface CardProps {
  /** @startingPoint section="Core" subtitle="Superficie base para paneles y listas" viewport="700x140" */
  padding?: number;
  radius?: 'xl' | '2xl' | '3xl';
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function Card(props: CardProps): JSX.Element;
