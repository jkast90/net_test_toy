import React from "react";
import buttonCss from "../../styles/Button.module.css";

export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  children: React.ReactNode;
}

/**
 * Standard Button component
 */
export default function Button({
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const sizeClass =
    size === "sm"
      ? buttonCss.buttonSm
      : size === "lg"
        ? buttonCss.buttonLg
        : "";

  const combinedClassName =
    `${buttonCss.button} ${sizeClass} ${className}`.trim();

  return (
    <button className={combinedClassName} {...props}>
      {children}
    </button>
  );
}
