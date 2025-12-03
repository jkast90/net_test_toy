import { useEffect } from "react";
import { createPortal } from "react-dom";
import DialogBanner from "./DialogBanner";
import dialogCss from "../../styles/Dialog.module.css";

export default function BaseDialog({
  open,
  onClose,
  children,
  className = "",
  "data-testid": testId = undefined,
}) {
  // Escape key handler
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const dialog = (
    <div className={dialogCss.overlay}>
      <div className={`${dialogCss.dialog} ${className}`} data-testid={testId}>
        <DialogBanner />
        {children}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
