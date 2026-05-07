export const Z_INDEX = {
  NAV: 30,
  DROPDOWN: 40,
  MODAL_OVERLAY: 50,
  MODAL_CONTENT: 51,
  TOAST: 70,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;