import { useCallback, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { EnrollmentStatus } from '@casillego/shared';
import { apiClient } from '../api/client';

/**
 * Body of POST /enrollments (specs/api-contracts/enrollments.md, feature 005).
 * Exactly one of `institutionId`/`joinCode` is set by the caller — the two
 * alternative paths of "Asociar a institución". `gradeOrGroup` is out of
 * scope for this screen (feeds delivery-point assignment later, per the
 * feature spec) and is never sent.
 */
export type AssociateInstitutionDraft =
  | { studentId: string; institutionId: string; joinCode?: undefined }
  | { studentId: string; joinCode: string; institutionId?: undefined };

/** Response 201 of the same endpoint. Only used to know the request succeeded. */
interface CreateEnrollmentResponse {
  id: string;
  studentId: string;
  institutionId: string;
  status: EnrollmentStatus;
  enrollmentCode: string;
  requestedAt: string;
}

export interface UseAssociateInstitutionValue {
  submitting: boolean;
  error: ApiError | null;
  associate: (draft: AssociateInstitutionDraft, onSuccess: () => void) => void;
}

export function useAssociateInstitution(): UseAssociateInstitutionValue {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const associate = useCallback((draft: AssociateInstitutionDraft, onSuccess: () => void) => {
    setSubmitting(true);
    setError(null);

    void apiClient
      .post<CreateEnrollmentResponse>('/enrollments', draft)
      .then(() => {
        onSuccess();
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 }),
        );
      })
      .finally(() => {
        setSubmitting(false);
      });
  }, []);

  return { submitting, error, associate };
}
