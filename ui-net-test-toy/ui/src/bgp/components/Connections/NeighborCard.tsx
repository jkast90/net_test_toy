import React from 'react';
import { Button, ButtonGroup } from '../../../_common/components';
import buttonCss from '../../../_common/styles/Button.module.css';
import styles from '../../pages/SharedBGPPages.module.css';
import { AggregatedNeighbor } from '../../../_common/services/multiClientBgpApi';
import { isBGPEstablished, getBGPStateName } from '../../../_common/utils/networkUtils';

interface NeighborCardProps {
  neighbor: AggregatedNeighbor;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const NeighborCard: React.FC<NeighborCardProps> = ({
  neighbor,
  isExpanded,
  onToggle,
  onEdit,
  onDelete
}) => {
  const isEstablished = isBGPEstablished(neighbor.state);

  return (
    <div className={styles.neighborCard}>
      <div
        className={styles.neighborCardHeader}
        onClick={onToggle}
      >
        <div className={styles.neighborId}>
          <span
            className={`${styles.dot} ${
              isEstablished ? styles.green : styles.red
            }`}
          />
          <strong>{neighbor.neighbor_ip}</strong>
          {neighbor.description && (
            <span className={styles.description}>
              ({neighbor.description.replace(/^"(.*)"$/, '$1')})
            </span>
          )}
          <span>Uptime: {isEstablished ? (neighbor.uptime_str || 'N/A') : 'N/A'}</span>
        </div>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </div>

      {isExpanded && (
        <div className={styles.neighborCardBody}>
          <div className={styles.neighGrid}>
            <span>Oper State:</span>
            <span>{getBGPStateName(neighbor.state)}</span>
            {neighbor.admin_shutdown !== undefined ? (
              <>
                <span>Admin State:</span>
                <span>{neighbor.admin_shutdown ? 'Shutdown' : 'Up'}</span>
              </>
            ) : (
              <>
                <span>Uptime:</span>
                <span>{isEstablished ? (neighbor.uptime_str || 'N/A') : 'N/A'}</span>
              </>
            )}
            <span>Peer ASN:</span> <span>{neighbor.remote_as}</span>
            <span>Local ASN:</span> <span>{neighbor.local_as}</span>
          </div>

          {neighbor.admin_shutdown !== undefined && (
            <div className={styles.neighGrid}>
              <span>Uptime:</span>
              <span>{isEstablished ? (neighbor.uptime_str || 'N/A') : 'N/A'}</span>
            </div>
          )}

          <ButtonGroup style={{ marginTop: '0.5rem' }}>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className={buttonCss.buttonSecondary}
            >
              Edit Description
            </Button>
            <Button
              className={buttonCss.buttonDelete}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              Delete
            </Button>
          </ButtonGroup>

          {neighbor.received_routes && neighbor.received_routes.length > 0 && (
            <div className={styles.section}>
              <h4>Received Routes ({neighbor.received_routes.length})</h4>
              <div className={styles.routeCount}>
                {neighbor.received_routes.length} routes received
              </div>
            </div>
          )}

          {neighbor.advertised_routes && neighbor.advertised_routes.length > 0 && (
            <div className={styles.section}>
              <h4>Advertised Routes ({neighbor.advertised_routes.length})</h4>
              <div className={styles.routeCount}>
                {neighbor.advertised_routes.length} routes advertised
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NeighborCard;
