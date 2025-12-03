import dialogCss from "../../styles/Dialog.module.css";

export function InputField({
  label,
  fieldRef,
  required = false,
  type = "text",
  placeholder = "",
  className = "",
  disabled = false,
  id,
  ...props
}) {
  return (
    <div className={dialogCss.fieldGroup}>
      <label className={dialogCss.labelText}>
        {label}{" "}
        {required && <span style={{ color: "var(--btn-delete-bg)" }}>*</span>}
      </label>
      <input
        ref={fieldRef}
        type={type}
        className={`${dialogCss.input} ${className}`}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        id={id}
        {...props}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options = [],
  required = false,
  className = "",
  disabled = false,
  id,
  ...props
}) {
  return (
    <div className={dialogCss.fieldGroup}>
      <label className={dialogCss.labelText}>
        {label}{" "}
        {required && <span style={{ color: "var(--btn-delete-bg)" }}>*</span>}
      </label>
      <select
        value={value}
        onChange={onChange}
        className={`${dialogCss.select} ${className}`}
        required={required}
        disabled={disabled}
        id={id}
        {...props}
      >
        {options.map((option, index) => (
          <option key={`${option.value}-${index}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  helpText,
  required = false,
  className = "",
  disabled = false,
  id,
  ...props
}) {
  return (
    <div className={dialogCss.fieldGroup}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className={className}
          required={required}
          disabled={disabled}
          id={id}
          {...props}
        />
        <span className={dialogCss.labelText} style={{ marginBottom: 0 }}>
          {label}{" "}
          {required && <span style={{ color: "var(--btn-delete-bg)" }}>*</span>}
        </span>
      </label>
      {helpText && (
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginLeft: '1.5rem' }}>
          {helpText}
        </div>
      )}
    </div>
  );
}
