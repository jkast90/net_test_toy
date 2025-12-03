// Packages
import React, { useEffect } from 'react';

// Contexts
import { useNavBarHeader } from '../../contexts/NavBarHeaderContext';

// Styling
import styles from './NavBarPageHeader.module.css';

interface NavBarPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
}

/**
 * NavBarPageHeader - Component for displaying page-specific header information in the navbar
 * Use this component within your page to set the navbar page header
 *
 * @example
 * ```tsx
 * <NavBarPageHeader
 *   title="Topology Builder"
 *   subtitle="Design your network"
 *   icon="🗺️"
 * />
 * ```
 */
export default function NavBarPageHeader({ title, subtitle, icon }: NavBarPageHeaderProps) {
  const { setHeaderContent } = useNavBarHeader();

  useEffect(() => {
    // Set the header content when component mounts
    setHeaderContent(
      <div className={styles.pageHeader}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <div className={styles.headerText}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>
    );

    // Clear the header content when component unmounts
    return () => {
      setHeaderContent(null);
    };
  }, [title, subtitle, icon, setHeaderContent]);

  // This component doesn't render anything in place
  return null;
}
