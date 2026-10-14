import { Check, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type Notice = { id: number; text: string; error?: boolean };

export default function Notification({
  message,
  dismiss,
}: {
  message: Notice | null;
  dismiss: () => void;
}) {
  const toast = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | SVGElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const active = document.activeElement;
    if (
      message &&
      (active instanceof HTMLElement || active instanceof SVGElement) &&
      !toast.current?.contains(active)
    )
      returnFocus.current = active;
    if (!message) {
      setFocused(false);
      setHovered(false);
    }
  }, [message]);
  useEffect(() => {
    if (!message || message.error || focused || hovered) return;
    const timer = window.setTimeout(dismiss, 7000);
    return () => window.clearTimeout(timer);
  }, [message, focused, hovered, dismiss]);
  const close = () => {
    if (toast.current?.contains(document.activeElement) && returnFocus.current?.isConnected)
      returnFocus.current.focus({ preventScroll: true });
    dismiss();
  };
  const content = message && (
    <div
      ref={toast}
      className={`toast ${message.error ? 'error' : ''}`}
      role={message.error ? 'alert' : undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        if (
          (event.relatedTarget instanceof HTMLElement ||
            event.relatedTarget instanceof SVGElement) &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          returnFocus.current = event.relatedTarget;
        setFocused(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      {message.error ? <TriangleAlert size={18} /> : <Check size={18} />}
      <span key={message.id}>{message.text}</span>
      <button className="icon-button" aria-label="Dismiss notification" onClick={close}>
        <X size={16} />
      </button>
    </div>
  );
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="action-feedback">
        {!message?.error && content}
      </div>
      {message?.error && content}
    </>
  );
}
