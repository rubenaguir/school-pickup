import { useMemo, useState, type KeyboardEvent } from 'react';
import { ApiError } from '@casillego/shared';
import { Alert } from '../components/Alert';
import { INPUT_STYLE } from '../components/Field';
import { institutionGroupSaveErrorMessage } from './institution-group-error-messages';
import type { InstitutionGroup } from './useInstitutionGroups';

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

const CHIP_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 6px 4px 11px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--surface-muted)',
  color: 'var(--ink-600)',
  fontSize: 13,
  fontWeight: 700,
} as const;

const CHIP_REMOVE_STYLE = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--ink-300)',
  fontSize: 15,
  lineHeight: 1,
  padding: '0 3px',
} as const;

const OPTION_STYLE = {
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  color: 'var(--ink-600)',
} as const;

interface GroupComboboxCommonProps {
  id: string;
  groups: InstitutionGroup[];
  groupsLoading: boolean;
  createGroup: (name: string) => Promise<InstitutionGroup>;
  disabled?: boolean;
}

interface GroupComboboxSingleProps extends GroupComboboxCommonProps {
  mode: 'single';
  /**
   * Display-only starting text (e.g. the enrollment's current `gradeOrGroup`
   * name) — never resolved to an id on its own. `onSelect`/`onClear` only
   * fire from an explicit user action, which always carries a real id (or
   * `null` for clear), so nothing here needs to eagerly match the name
   * against the loaded catalog to work correctly. See ADR-084 punto 8.
   */
  initialName: string | null;
  onSelect: (group: InstitutionGroup) => void;
  onClear: () => void;
}

interface GroupComboboxMultiProps extends GroupComboboxCommonProps {
  mode: 'multi';
  value: InstitutionGroup[];
  onChange: (next: InstitutionGroup[]) => void;
}

type GroupComboboxProps = GroupComboboxSingleProps | GroupComboboxMultiProps;

/**
 * Autocompletar-o-crear sobre el catálogo `institution_groups` (ADR-084 punto
 * 8): reemplaza el `<input>`/tag-box de texto libre que `DeliveryPoints.tsx`,
 * `PendingEnrollments.tsx` y `Students.tsx` usaban para `assignedGroups`/
 * `gradeOrGroup`. Escribir un nombre que no coincide con ningún grupo
 * existente ofrece "Crear grupo '{texto}'"; elegirla llama
 * `POST /institutions/:id/groups` de inmediato, no en batch al guardar el
 * formulario que la contiene.
 *
 * Portal-local, no `@casillego/ui`: mismo criterio que `Field`/`Alert` — esta
 * no es una decisión de design system (ADR-036).
 */
export function GroupCombobox(props: GroupComboboxProps) {
  const { id, groups, groupsLoading, createGroup, disabled } = props;
  const [query, setQuery] = useState(props.mode === 'single' ? (props.initialName ?? '') : '');
  const [confirmedName, setConfirmedName] = useState(
    props.mode === 'single' ? (props.initialName ?? '') : '',
  );
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<ApiError | null>(null);

  const trimmedQuery = query.trim();
  const selectedValue = props.mode === 'multi' ? props.value : null;

  const candidates = useMemo(() => {
    if (!selectedValue) return groups;
    const selectedIds = new Set(selectedValue.map((group) => group.id));
    return groups.filter((group) => !selectedIds.has(group.id));
  }, [groups, selectedValue]);

  const matches = useMemo(() => {
    if (trimmedQuery.length === 0) return candidates;
    const needle = normalize(trimmedQuery);
    return candidates.filter((group) => group.name.toLowerCase().includes(needle));
  }, [candidates, trimmedQuery]);

  const exactMatch = groups.some((group) => normalize(group.name) === normalize(trimmedQuery));
  const showCreateOption = trimmedQuery.length > 0 && !exactMatch;

  function selectGroup(group: InstitutionGroup) {
    if (props.mode === 'multi') {
      props.onChange([...props.value, group]);
      setQuery('');
    } else {
      props.onSelect(group);
      setQuery(group.name);
      setConfirmedName(group.name);
    }
    setOpen(false);
    setCreateError(null);
  }

  function removeChip(groupId: string) {
    if (props.mode !== 'multi') return;
    props.onChange(props.value.filter((group) => group.id !== groupId));
  }

  function handleCreate() {
    if (trimmedQuery.length === 0 || creating) return;
    setCreating(true);
    setCreateError(null);
    createGroup(trimmedQuery)
      .then((created) => selectGroup(created))
      .catch((caught: unknown) => {
        setCreateError(caught instanceof ApiError ? caught : null);
      })
      .finally(() => setCreating(false));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (matches.length > 0 && trimmedQuery.length > 0) {
        selectGroup(matches[0]);
      } else if (showCreateOption) {
        handleCreate();
      }
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (
      props.mode === 'multi' &&
      event.key === 'Backspace' &&
      query === '' &&
      props.value.length > 0
    ) {
      removeChip(props.value[props.value.length - 1].id);
    }
  }

  function handleBlur() {
    // Delayed so a mousedown on a dropdown option still registers as a click
    // before the blur closes it.
    window.setTimeout(() => {
      setOpen(false);
      if (props.mode === 'single') {
        setQuery(confirmedName);
      }
    }, 120);
  }

  function handleClear() {
    if (props.mode !== 'single') return;
    setQuery('');
    setConfirmedName('');
    props.onClear();
  }

  return (
    <span
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        minWidth: 0,
        position: 'relative',
      }}
    >
      <span
        style={{
          minHeight: 46,
          border: '1px solid var(--border-strong)',
          borderRadius: 10,
          padding: '7px 10px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 7,
        }}
      >
        {props.mode === 'multi' &&
          props.value.map((group) => (
            <span key={group.id} style={CHIP_STYLE}>
              {group.name}
              <button
                type="button"
                aria-label={`Quitar ${group.name}`}
                onClick={() => removeChip(group.id)}
                style={CHIP_REMOVE_STYLE}
              >
                ×
              </button>
            </span>
          ))}
        <input
          id={id}
          value={query}
          disabled={disabled || groupsLoading}
          placeholder={
            groupsLoading
              ? 'Cargando grupos…'
              : props.mode === 'multi' && props.value.length > 0
                ? undefined
                : 'Escribe para buscar o crear…'
          }
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setCreateError(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          style={{ ...INPUT_STYLE, minWidth: 140, fontSize: 14 }}
        />
        {props.mode === 'single' && query.length > 0 && !disabled && (
          <button
            type="button"
            aria-label="Quitar grupo"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClear}
            style={CHIP_REMOVE_STYLE}
          >
            ×
          </button>
        )}
      </span>

      {open && !groupsLoading && !disabled && (matches.length > 0 || showCreateOption) && (
        <span
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            padding: 4,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {matches.map((group) => (
            <button
              key={group.id}
              type="button"
              // mousedown (not click) fires before the input's blur handler,
              // so the selection lands before handleBlur would reset query.
              onMouseDown={(event) => {
                event.preventDefault();
                selectGroup(group);
              }}
              style={OPTION_STYLE}
            >
              {group.name}
            </button>
          ))}
          {showCreateOption && (
            <button
              type="button"
              disabled={creating}
              onMouseDown={(event) => {
                event.preventDefault();
                handleCreate();
              }}
              style={{ ...OPTION_STYLE, fontWeight: 700, color: 'var(--brand-strong)' }}
            >
              {creating ? 'Creando…' : `Crear grupo "${trimmedQuery}"`}
            </button>
          )}
        </span>
      )}

      {createError && (
        <Alert
          message={institutionGroupSaveErrorMessage(createError.code)}
          code={createError.code}
        />
      )}
    </span>
  );
}
