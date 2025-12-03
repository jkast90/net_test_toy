import React from 'react';
import { InputField, SelectField } from '../../../_common/components/ui';
import styles from '../../pages/NetworkTesting.module.css';

interface CurlParametersFormProps {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  count: number;
  sleep: string;
  curlInterface: string;
  resolve: string;
  caCert: string;
  header: string;
  dataBinary: string;
  verbose: boolean;
  showHeaders: boolean;
  veryVerbose: boolean;
  insecure: boolean;
  onMethodChange: (value: 'GET' | 'POST' | 'DELETE') => void;
  onPathChange: (value: string) => void;
  onCountChange: (value: number) => void;
  onSleepChange: (value: string) => void;
  onInterfaceChange: (value: string) => void;
  onResolveChange: (value: string) => void;
  onCaCertChange: (value: string) => void;
  onHeaderChange: (value: string) => void;
  onDataBinaryChange: (value: string) => void;
  onVerboseChange: (value: boolean) => void;
  onShowHeadersChange: (value: boolean) => void;
  onVeryVerboseChange: (value: boolean) => void;
  onInsecureChange: (value: boolean) => void;
}

const CurlParametersForm: React.FC<CurlParametersFormProps> = ({
  method,
  path,
  count,
  sleep,
  curlInterface,
  resolve,
  caCert,
  header,
  dataBinary,
  verbose,
  showHeaders,
  veryVerbose,
  insecure,
  onMethodChange,
  onPathChange,
  onCountChange,
  onSleepChange,
  onInterfaceChange,
  onResolveChange,
  onCaCertChange,
  onHeaderChange,
  onDataBinaryChange,
  onVerboseChange,
  onShowHeadersChange,
  onVeryVerboseChange,
  onInsecureChange
}) => {
  return (
    <>
      <div className={styles.formGrid2}>
        <SelectField
          label="Method"
          value={method}
          onChange={(e) => onMethodChange(e.target.value as 'GET' | 'POST' | 'DELETE')}
          options={[
            { value: 'GET', label: 'GET' },
            { value: 'POST', label: 'POST' },
            { value: 'DELETE', label: 'DELETE' }
          ]}
        />
        <InputField
          label="Path"
          type="text"
          value={path}
          onChange={(e) => onPathChange(e.target.value)}
          placeholder="/index.html"
        />
        <InputField
          label="Request Count"
          type="number"
          value={count}
          onChange={(e) => onCountChange(parseInt(e.target.value))}
          min={1}
        />
        <InputField
          label="Sleep Time (s)"
          type="text"
          value={sleep}
          onChange={(e) => onSleepChange(e.target.value)}
          placeholder="0.001"
        />
        <InputField
          label="Interface"
          type="text"
          value={curlInterface}
          onChange={(e) => onInterfaceChange(e.target.value)}
          placeholder="Source IP"
        />
        <InputField
          label="Resolve"
          type="text"
          value={resolve}
          onChange={(e) => onResolveChange(e.target.value)}
          placeholder="host:port:ip"
        />
        <InputField
          label="CA Cert File"
          type="text"
          value={caCert}
          onChange={(e) => onCaCertChange(e.target.value)}
          placeholder="root-ca.pem"
        />
      </div>
      <InputField
        label="Header"
        type="text"
        value={header}
        onChange={(e) => onHeaderChange(e.target.value)}
        placeholder="Host: example.com"
      />
      <InputField
        label="Data Binary"
        type="text"
        value={dataBinary}
        onChange={(e) => onDataBinaryChange(e.target.value)}
        placeholder="Request body data"
      />
      <div className={styles.formGrid2} style={{ marginBottom: '1.5rem' }}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={verbose} onChange={(e) => onVerboseChange(e.target.checked)} />
          Verbose
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={showHeaders} onChange={(e) => onShowHeadersChange(e.target.checked)} />
          Show Headers
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={veryVerbose} onChange={(e) => onVeryVerboseChange(e.target.checked)} />
          Very Verbose
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={insecure} onChange={(e) => onInsecureChange(e.target.checked)} />
          Insecure (Skip SSL)
        </label>
      </div>
    </>
  );
};

export default CurlParametersForm;
