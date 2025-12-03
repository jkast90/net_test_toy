import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import buttonCss from "../../styles/Button.module.css";
import styles from "./DialogActions.module.css";

export default function DialogActions({
  onCancel,
  onSubmit,
  cancelText = "Cancel",
  submitText = "Save",
  submitDisabled = false,
  cancelDisabled = false,
  isLoading = false,
  loadingText = "Saving...",
  additionalActions = [],
  sticky = false,
  "data-testid": testId = undefined,
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const buttonContainer = (
    <div className={buttonCss.prompt}>
      {additionalActions.map((action, index) => (
        <button
          key={index}
          type="button"
          className={buttonCss.button}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.text}
        </button>
      ))}
      {cancelText && (
        <button
          type="button"
          className={buttonCss.button}
          onClick={onCancel}
          disabled={cancelDisabled}
        >
          {cancelText}
        </button>
      )}
      <button
        type="submit"
        className={buttonCss.button}
        onClick={onSubmit}
        disabled={submitDisabled}
        data-testid={testId}
      >
        {isLoading ? loadingText : submitText}
      </button>
    </div>
  );

  if (sticky) {
    const stickyContent = (
      <div className={styles.stickyActions}>
        {buttonContainer}
      </div>
    );

    // On mobile, render to body using portal for true fixed positioning
    if (isMobile && typeof document !== 'undefined') {
      return createPortal(stickyContent, document.body);
    }

    return stickyContent;
  }

  return buttonContainer;
}
