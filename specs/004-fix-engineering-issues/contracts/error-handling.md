# Error Handling Contract: Centralized Error Surfacing

**Branch**: `004-fix-engineering-issues` | **Date**: 2026-04-18

## Overview

This contract defines the error handling pattern that replaces silent error discarding throughout the application. All Supabase query results must check for errors and surface them to the user via the toast notification system.

## Hook: `useErrorToast`

```typescript
// hooks/useErrorToast.ts
interface UseErrorToast {
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}
```

### Usage Pattern

**Before (current — errors silently discarded)**:
```typescript
const { data } = await supabase.from('table').select('*');
if (data) setSomething(data);
// error is silently discarded
```

**After (new — errors surfaced)**:
```typescript
const { showError } = useErrorToast();

const { data, error } = await supabase.from('table').select('*');
if (error) {
  showError(error.message);
  return;
}
if (data) setSomething(data);
```

## Service Layer Pattern

Each service function must return a structured result type:

```typescript
// types.ts addition
interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// Usage in services
async function fetchEmployees(): Promise<ServiceResult<Employee[]>> {
  const { data, error } = await supabase.from('employees').select('*');
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}
```

View components call service functions and handle errors:

```typescript
const { showError } = useErrorToast();
const result = await fetchEmployees();
if (result.error) {
  showError(result.error);
  return;
}
setEmployees(result.data);
```

## Error Boundary Integration

Uncaught runtime errors in React components are caught by the ErrorBoundary component (not the toast system). The separation is:

| Error Type | Handling | Component |
|------------|----------|-----------|
| Supabase query error (network, permission, validation) | Toast notification | `useErrorToast` hook |
| React runtime error (render crash, null reference) | Error boundary fallback | `ErrorBoundary` component |
| Destructive action confirmation | Confirmation modal | `ConfirmationModal` component |

## Toast Notification Behavior

| Type | Duration | Auto-dismiss | Action Button |
|------|----------|--------------|---------------|
| success | 4000ms | Yes | No |
| error | 6000ms | Yes | Optional ("Retry") |
| warning | 5000ms | Yes | No |
| info | 4000ms | Yes | No |

### Accessibility Requirements

- Toast container uses `aria-live="polite"` for non-urgent notifications
- Error toasts use `role="alert"` and `aria-live="assertive"` to interrupt screen readers
- Focus is NOT moved to toast (does not disrupt user workflow)
- Multiple toasts stack vertically with newest at the bottom

### Z-Index

Toast container uses `z-index: 70` (from existing `constants/zIndex.ts` `Z_INDEX.TOAST`), which is above modal content (51) and below only debug overlays.

## Confirmation Modal Behavior

| Property | Value |
|----------|-------|
| Blocking | Yes — overlay prevents interaction with underlying UI |
| Focus trap | Yes — Tab/Shift+Tab cycles within modal |
| Escape key | Cancels the action |
| Initial focus | Cancel button (safe default) |
| Background | Semi-transparent overlay at `z-index: 50` (MODAL_OVERLAY) |

### Actions Requiring Confirmation Modal

| Action | Current Implementation | Variant |
|--------|----------------------|---------|
| Delete employee | `window.confirm()` | danger |
| Void transaction | `window.confirm()` | danger |
| Approve refund | `window.confirm()` | warning |
| Delete inventory item | `window.confirm()` | danger |
| Convert branch transactions | `window.confirm()` | warning |
| Delete branch transactions | `window.confirm()` | danger |
| Approve/reject leave request | `window.confirm()` | default |

All instances of `window.confirm()` and `window.alert()` must be replaced with the appropriate component per the table above.

## Error Message Formatting

- Use user-friendly messages, not raw Supabase error strings
- Translation-aware: messages should pass through the `t()` translation function for localized display
- For known error codes, provide human-readable alternatives:
  - `PGRST116` (not found) → "The requested record was not found"
  - `23505` (unique violation) → "This record already exists"
  - `42501` (insufficient privilege) → "You do not have permission to perform this action"
  - Network errors → "Unable to connect. Please check your internet connection and try again"