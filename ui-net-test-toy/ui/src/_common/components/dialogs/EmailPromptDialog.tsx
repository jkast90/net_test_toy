// Packages
import React, { useState, useEffect, useRef } from "react";

// Settings
import { setBypassEmail } from "../../settings";

// Components
import { DialogActions } from "../ui";

// Styling
import dialogCss from "../../styles/Dialog.module.css";

export default function EmailPromptDialog({ open, onEmailSet }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && emailInputRef.current) {
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, [open]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    // Save the email and close dialog
    setBypassEmail(email.trim());
    onEmailSet(email.trim());
    setError("");
  };

  const handleSave = () => {
    handleSubmit(undefined);
  };

  const handleKeyDown = (e) => {
    // Prevent closing on Escape when auth is disabled
    if (e.key === "Escape") {
      if (e) e.preventDefault();
      e.stopPropagation();
    }
  };

  if (!open) return null;

  return (
    <div
      className={dialogCss.overlay}
      onKeyDown={handleKeyDown}
      style={{ zIndex: 10000 }} // Ensure it's above everything
    >
      <div className={dialogCss.dialog} style={{ maxWidth: "400px" }}>
        <div className={dialogCss.header}>
          <h2 style={{ margin: 0, color: "var(--text)" }}>📧 Email Required</h2>
        </div>

        <div className={dialogCss.content}>
          <p
            style={{
              marginBottom: "1rem",
              color: "var(--text)",
              lineHeight: "1.5",
            }}
          >
            Authentication is disabled. Please enter your email address to
            continue using the application.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1rem" }}>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "var(--text)",
                  fontWeight: "500",
                }}
              >
                Email Address:
              </label>
              <input
                ref={emailInputRef}
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(""); // Clear error when typing
                }}
                placeholder="your.email@example.com"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  border: error
                    ? "2px solid #e74c3c"
                    : "1px solid var(--border)",
                  borderRadius: "4px",
                  backgroundColor: "var(--input-bg)",
                  color: "var(--text)",
                  outline: "none",
                }}
                autoComplete="email"
                required
              />
              {error && (
                <p
                  style={{
                    color: "#e74c3c",
                    fontSize: "0.9rem",
                    marginTop: "0.5rem",
                    marginBottom: 0,
                  }}
                >
                  {error}
                </p>
              )}
            </div>

            <DialogActions
              onCancel={() => {}}
              onSubmit={handleSave} // Form submission handled by form's onSubmit
              cancelText=""
              submitText="Continue"
            />
          </form>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
            }}
          >
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                margin: 0,
                lineHeight: "1.4",
              }}
            >
              💡 <strong>Note:</strong> This email will be used to identify your
              data and preferences. You can change it later in Settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
