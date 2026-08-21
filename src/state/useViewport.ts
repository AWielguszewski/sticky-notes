import { useSyncExternalStore } from 'react';
import { viewportStore } from './viewportStore';

/** Re-renders on zoom only: panning leaves the scale untouched, so the snapshot is unchanged. */
export const useZoom = (): number =>
  useSyncExternalStore(viewportStore.subscribe, () => viewportStore.get().scale);
