import { useToast, TOAST_DURATION } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={TOAST_DURATION}>
      {toasts.map(({ id, title, description, action, duration, createdAt, ...props }) => {
        const toastDuration = duration ?? TOAST_DURATION;

        const elapsed = createdAt ? Date.now() - createdAt : 0;
        const remaining = Math.max(0, toastDuration - elapsed);
        const startScale = remaining / toastDuration;

        return (
          <Toast key={id} duration={toastDuration} {...props}>
            <div className="grid gap-1 relative w-full pt-1 pb-2">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
            <div
              className="absolute bottom-0 left-0 h-1 bg-primary origin-left rounded-b-md"
              style={{
                width: "100%",
                transform: `scaleX(${startScale})`,
                animation: `shrink-width ${remaining}ms linear forwards`,
              }}
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}