import React from 'react';

export interface ErrorStateProps {
  /** @startingPoint section="Feedback" subtitle="Mensaje del backend + código + Reintentar" viewport="700x320" */
  title: string;
  message?: string;
  code?: string;
  onRetry?: () => void;
}

export declare function ErrorState(props: ErrorStateProps): JSX.Element;
