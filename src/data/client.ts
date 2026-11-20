import raw from './gta6.json';
import type { Dataset } from './schema';

/**
 * Dataset for browser islands. It ships once as a shared, cached script chunk instead of being
 * repeated in each island's props. The build (src/data/index.ts) and CI have already validated it.
 */
export const clientData = raw as Dataset;
