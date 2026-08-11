import { useCallback, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { StudentGuardianRelationship } from '@casillego/shared';
import { apiClient } from '../api/client';

/** Body of POST /students (specs/api-contracts/students.md), as gathered by the form. */
export interface NewStudentDraft {
  fullName: string;
  birthDate: string | null;
  relationship: StudentGuardianRelationship;
}

/** Response 201 of the same endpoint. Only used to know the request succeeded. */
interface CreateStudentResponse {
  id: string;
  fullName: string;
  birthDate: string | null;
  photoUrl: string | null;
  createdByUserId: string;
}

export interface UseCreateStudentValue {
  creating: boolean;
  error: ApiError | null;
  create: (draft: NewStudentDraft, onSuccess: () => void) => void;
}

/**
 * POST /students (feature 004). `photoUrl` is always sent as `null`: the
 * "Alta de alumno" screen has no photo field, on purpose — ADR-058.
 */
export function useCreateStudent(): UseCreateStudentValue {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const create = useCallback((draft: NewStudentDraft, onSuccess: () => void) => {
    setCreating(true);
    setError(null);

    void apiClient
      .post<CreateStudentResponse>('/students', {
        fullName: draft.fullName,
        birthDate: draft.birthDate,
        photoUrl: null,
        relationship: draft.relationship,
      })
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
        setCreating(false);
      });
  }, []);

  return { creating, error, create };
}
