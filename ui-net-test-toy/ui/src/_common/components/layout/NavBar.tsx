// Packages
import { Link, useLocation } from "react-router-dom";

// Contexts
import { useBanner } from "../../hooks/useReduxBanner.ts";
import { useNavBarHeader } from "../../contexts/NavBarHeaderContext";

// Components
import ContainerManagerSelector from "../ContainerManagerSelector";

// Styling
import styles from "./NavBar.module.css";

export default function NavBar() {
  const { pathname } = useLocation();
  const { banner, closeBanner } = useBanner();
  const { headerContent } = useNavBarHeader();

  return (
    <nav className={styles.navbar}>
      <div className={styles.navLeft}>
        <Link to="/about" className={styles.logoLink} aria-label="About">
          <img src="/routeherald-logo.png" alt="Route Herald" className={styles.logo} />
        </Link>
        {headerContent}
        {banner && (
          <div
            className={`${styles.banner} ${
              styles[
                `banner${
                  banner.type.charAt(0).toUpperCase() + banner.type.slice(1)
                }`
              ]
            }`}
          >
            <span>{banner.message}</span>
            <button
              className={styles.bannerClose}
              onClick={closeBanner}
              aria-label="Close banner"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <div className={styles.navRight}>
        <Link
          to="/dashboard"
          className={`${styles.link} ${pathname === "/dashboard" ? styles.active : ""}`}
        >
          Dashboard
        </Link>
        <Link
          to="/bmp"
          className={`${styles.link} ${pathname === "/bmp" ? styles.active : ""}`}
        >
          BMP
        </Link>
        <Link
          to="/netflow"
          className={`${styles.link} ${pathname === "//netflow" ? styles.active : ""}`}
        >
          NetFlow
        </Link>
        <Link
          to="/testing"
          className={`${styles.link} ${pathname === "/testing" ? styles.active : ""}`}
        >
          Testing
        </Link>
        <Link
          to="/topology"
          className={`${styles.link} ${pathname === "/topology" ? styles.active : ""}`}
        >
          Topology
        </Link>
        <ContainerManagerSelector />
      </div>
    </nav>
  );
}