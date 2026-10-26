import { useSyncExternalStore } from "react";

/** Radix dialogs lock page scroll by setting this attribute on <body> while open. */
const LOCK = "data-scroll-locked";

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.body, { attributes: true, attributeFilter: [LOCK] });
  return () => obs.disconnect();
}

/**
 * True while a modal dialog covers the app. 3D views pause then: they're hidden behind the
 * overlay, and redrawing a canvas under a blurred backdrop is costly on iPad (and in WebKit).
 */
export function useModalOpen() {
  return useSyncExternalStore(
    subscribe,
    () => document.body.hasAttribute(LOCK),
    () => false,
  );
}
