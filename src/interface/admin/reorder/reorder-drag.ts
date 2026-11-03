export interface Drop {
  /** The ids of the page in the order they now have. */
  order: string[];
  /** The 0-based place in the whole list: what the server is asked for. */
  position: number;
}

/**
 * What a drop means: the dragged item takes the place of the one it was dropped on. `offset` is
 * how many items come before this page, so a page of a long list sends a place in the whole list.
 * Null when nothing moved (dropped on itself or outside the list, or an id the page does not have).
 */
export function dropResult(ids: readonly string[], activeId: string, overId: string | null | undefined, offset: number): Drop | null {
  if (overId === null || overId === undefined || overId === activeId) return null;

  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);

  if (from === -1 || to === -1) return null;

  const order = [...ids];

  order.splice(from, 1);
  order.splice(to, 0, activeId);

  return { order, position: offset + to };
}

/** Said aloud when a place is announced: the same wording as the toast of the move buttons. */
export function placeMessage(label: string, position: number, total: number): string {
  return `${label}: posición ${position} de ${total}.`;
}
