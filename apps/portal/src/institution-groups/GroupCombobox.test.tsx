import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GroupCombobox } from './GroupCombobox';
import type { InstitutionGroup } from './useInstitutionGroups';

const GROUP_3A: InstitutionGroup = {
  id: 'group-3a',
  institutionId: 'inst-1',
  name: '3A',
  enrollmentsCount: 0,
  deliveryPointsCount: 0,
};

const GROUP_3B: InstitutionGroup = {
  id: 'group-3b',
  institutionId: 'inst-1',
  name: '3B',
  enrollmentsCount: 0,
  deliveryPointsCount: 0,
};

function renderCombobox(initialName: string | null, onSelect = vi.fn()) {
  return render(
    <GroupCombobox
      id="group"
      mode="single"
      groups={[GROUP_3A, GROUP_3B]}
      groupsLoading={false}
      createGroup={vi.fn()}
      initialName={initialName}
      onSelect={onSelect}
      onClear={vi.fn()}
    />,
  );
}

describe('GroupCombobox (mode single)', () => {
  it('keeps the just-selected group visible through blur even while the parent still passes the stale initialName', async () => {
    const onSelect = vi.fn();
    const { rerender } = renderCombobox('3A', onSelect);

    const input = screen.getByPlaceholderText('Escribe para buscar o crear…');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '3B' } });

    const option = await screen.findByRole('button', { name: '3B' });
    fireEvent.mouseDown(option);

    expect(onSelect).toHaveBeenCalledWith(GROUP_3B);
    expect(input).toHaveValue('3B');

    // Blur simulates clicking "Guardar" and moving focus away, before the
    // in-flight PATCH resolves — the parent re-renders with the *same* stale
    // initialName it always had, exactly like the reported race.
    fireEvent.blur(input);
    rerender(
      <GroupCombobox
        id="group"
        mode="single"
        groups={[GROUP_3A, GROUP_3B]}
        groupsLoading={false}
        createGroup={vi.fn()}
        initialName="3A"
        onSelect={onSelect}
        onClear={vi.fn()}
      />,
    );

    // handleBlur's revert runs on a 120ms timeout. `waitFor` would resolve on
    // its first (already-passing) check without ever letting that timeout
    // fire, so the wait has to be unconditional: let the real 120ms elapse,
    // *then* assert the field never fell back to the stale "3A".
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(input).toHaveValue('3B');
  });

  it('still reverts to the confirmed name on a blur with no prior selection', async () => {
    renderCombobox('3A');

    const input = screen.getByPlaceholderText('Escribe para buscar o crear…');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'algo que no existe' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(input).toHaveValue('3A');
    });
  });
});
