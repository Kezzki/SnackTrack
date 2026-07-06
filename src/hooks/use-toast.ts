import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 2;
const TOAST_DURATION = 4000; // ms — drives both auto-dismiss and the timer bar animation
const TOAST_REMOVE_DELAY = 400; // ms — slide-out animation before DOM removal

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  duration?: number;
  createdAt?: number; // timestamp set on ADD_TOAST — used to find the closest-to-expiry toast
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | { type: ActionType["ADD_TOAST"]; toast: ToasterToast }
  | { type: ActionType["UPDATE_TOAST"]; toast: Partial<ToasterToast> }
  | { type: ActionType["DISMISS_TOAST"]; toastId?: ToasterToast["id"] }
  | { type: ActionType["REMOVE_TOAST"]; toastId?: ToasterToast["id"] };

interface State {
  toasts: ToasterToast[];
}

const toastRemoveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const toastDismissTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const scheduleRemove = (toastId: string) => {
  if (toastRemoveTimeouts.has(toastId)) return;
  const timeout = setTimeout(() => {
    toastRemoveTimeouts.delete(toastId);
    dispatch({ type: "REMOVE_TOAST", toastId });
  }, TOAST_REMOVE_DELAY);
  toastRemoveTimeouts.set(toastId, timeout);
};

/** Returns the id of whichever active toast has the least time remaining. */
function getClosestToExpiry(toasts: ToasterToast[]): string | undefined {
  const now = Date.now();
  let soonestId: string | undefined;
  let soonestRemaining = Infinity;

  for (const t of toasts) {
    const elapsed = now - (t.createdAt ?? now);
    const remaining = (t.duration ?? TOAST_DURATION) - elapsed;
    if (remaining < soonestRemaining) {
      soonestRemaining = remaining;
      soonestId = t.id;
    }
  }

  return soonestId;
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST": {
      if (state.toasts.length >= TOAST_LIMIT) {
        const evictId = getClosestToExpiry(state.toasts);
        if (evictId) {
          // Slide out the closest-to-expiry toast
          setTimeout(() => dispatch({ type: "DISMISS_TOAST", toastId: evictId }), 0);
          const remaining = state.toasts.filter((t) => t.id !== evictId);
          return { ...state, toasts: [action.toast, ...remaining] };
        }
      }
      return { ...state, toasts: [action.toast, ...state.toasts] };
    }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      if (toastId) {
        scheduleRemove(toastId);
        const dt = toastDismissTimeouts.get(toastId);
        if (dt) { clearTimeout(dt); toastDismissTimeouts.delete(toastId); }
      } else {
        state.toasts.forEach((toast) => {
          scheduleRemove(toast.id);
          const dt = toastDismissTimeouts.get(toast.id);
          if (dt) { clearTimeout(dt); toastDismissTimeouts.delete(toast.id); }
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, open: false } : t
        ),
      };
    }

    case "REMOVE_TOAST":
      if (action.toastId === undefined) return { ...state, toasts: [] };
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) };
  }
};

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();
  const duration = props.duration ?? TOAST_DURATION;
  const createdAt = Date.now();

  const update = (props: ToasterToast) =>
    dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      duration,
      createdAt,
      open: true,
      onOpenChange: (open) => { if (!open) dismiss(); },
    },
  });

  const timerId = setTimeout(dismiss, duration);
  toastDismissTimeouts.set(id, timerId);

  return { id, dismiss, update };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
    TOAST_DURATION,
  };
}

export { useToast, toast, TOAST_DURATION };