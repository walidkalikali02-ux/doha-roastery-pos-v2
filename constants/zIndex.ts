export const Z_INDEX = {
  NAV: 30,
  DROPDOWN: 40,
  MODAL_OVERLAY: 50,
  MODAL_CONTENT: 51,
  POS_PAYMENT_MODAL: 250,
  POS_SUCCESS_MODAL: 300,
  TOAST: 9999,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;