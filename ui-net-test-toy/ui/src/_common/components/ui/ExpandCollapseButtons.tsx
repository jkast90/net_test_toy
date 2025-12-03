import React from "react";
import buttonCss from "../../styles/Button.module.css";

interface ExpandCollapseButtonsProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  expandTitle?: string;
  collapseTitle?: string;
}

const ExpandCollapseButtons: React.FC<ExpandCollapseButtonsProps> = ({
  onExpandAll,
  onCollapseAll,
  expandTitle = "Expand all",
  collapseTitle = "Collapse all",
}) => {
  return (
    <>
      <button
        className={`btn btn-sm ${buttonCss.button} ${buttonCss.buttonSm}`}
        onClick={onExpandAll}
        title={expandTitle}
      >
        ▼
      </button>
      <button
        className={`btn btn-sm ${buttonCss.button} ${buttonCss.buttonSm}`}
        onClick={onCollapseAll}
        title={collapseTitle}
      >
        ▲
      </button>
    </>
  );
};

export default ExpandCollapseButtons;
