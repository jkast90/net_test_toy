// src/components/ToggleSwitch.jsx
// Styling
import styles from "./ToggleSwitch.module.css";

export default function ToggleSwitch({
  labelLeft,
  labelRight,
  checked,
  onChange,
  id,
}) {
  return (
    <div className={styles.toggleContainer}>
      <span className={styles.label}>{labelLeft}</span>
      <label className={styles.switch} htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={onChange} />
        <span className={styles.slider}></span>
      </label>
      <span className={styles.label}>{labelRight}</span>
    </div>
  );
}
