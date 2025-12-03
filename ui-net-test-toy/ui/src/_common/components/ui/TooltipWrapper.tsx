// components/TooltipWrapper.tsx
// Packages
import { useState } from "react";

// Styling
import tooltipCss from "../../styles/Tooltip.module.css";

interface TooltipWrapperProps {
  children: React.ReactNode;
  tooltip: string;
  direction?: "above" | "below";
}

export default function TooltipWrapper({
  children,
  tooltip,
  direction = "above",
}: TooltipWrapperProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", display: "inline-block" }}
    >
      {children}
      {hovered && tooltip && (
        <div
          className={`${tooltipCss.tooltip} ${
            direction === "above" ? tooltipCss.above : ""
          }`}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
