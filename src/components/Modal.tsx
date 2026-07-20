import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";

/** Viewport-centered modal via portal (avoids layout transform / scroll offset bugs). */
export function Modal({
  onClose,
  children,
  panelClassName,
}: {
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-0 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={cn(
              "relative w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-h-[min(90vh,920px)] overflow-y-auto",
              panelClassName,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
