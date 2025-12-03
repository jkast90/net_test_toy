import dialogCss from "../../styles/Dialog.module.css";
import { useBanner } from "../../hooks/useReduxBanner.ts";

export default function DialogBanner() {
  const { banner, closeBanner } = useBanner();

  if (!banner) return null;

  // Apply type-specific styling like the main banner
  const bannerTypeClass = banner.type
    ? dialogCss[
        `banner${banner.type.charAt(0).toUpperCase() + banner.type.slice(1)}`
      ]
    : "";

  return (
    <div className={`${dialogCss.banner} ${bannerTypeClass}`}>
      <span>{banner.message}</span>
      <button
        className={dialogCss.bannerClose}
        onClick={closeBanner}
        aria-label="Close banner"
      >
        ×
      </button>
    </div>
  );
}
