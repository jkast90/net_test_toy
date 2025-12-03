import React from 'react';
import styles from './CardGrid.module.css';

interface CardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5 | 'auto';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * CardGrid component for displaying cards in a responsive grid layout
 *
 * @param columns - Number of columns per row (2-5) or 'auto' for auto-fill
 * @param children - Card components to display in the grid
 * @param className - Additional CSS classes
 *
 * @example
 * <CardGrid columns={3}>
 *   <Card>Content 1</Card>
 *   <Card>Content 2</Card>
 *   <Card>Content 3</Card>
 * </CardGrid>
 */
const CardGrid: React.FC<CardGridProps> = ({
  children,
  columns = 'auto',
  className = '',
  style
}) => {
  return (
    <div
      className={`${styles.cardGrid} ${className}`}
      data-columns={columns}
      style={style}
    >
      {children}
    </div>
  );
};

export default CardGrid;
