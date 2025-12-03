import React from 'react';
import { InputField } from '../../../_common/components/ui';

interface TracerouteParametersFormProps {
  maxHops: number;
  onMaxHopsChange: (value: number) => void;
}

const TracerouteParametersForm: React.FC<TracerouteParametersFormProps> = ({
  maxHops,
  onMaxHopsChange
}) => {
  return (
    <InputField
      label="Max Hops"
      type="number"
      value={maxHops}
      onChange={(e) => onMaxHopsChange(parseInt(e.target.value))}
      min={1}
      max={255}
    />
  );
};

export default TracerouteParametersForm;
