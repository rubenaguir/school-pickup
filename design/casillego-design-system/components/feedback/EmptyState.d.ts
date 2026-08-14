import React from 'react';

export interface EmptyStateProps {
  /** @startingPoint section="Feedback" subtitle="Vacío factual con acción opcional" viewport="700x320" */
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export declare function EmptyState(props: EmptyStateProps): JSX.Element;
