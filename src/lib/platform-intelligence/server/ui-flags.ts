/** Request-time server flag; never expose env values or use NEXT_PUBLIC build-time flags. */
export function platformOperationsEnabled(){return process.env.STORAGE_MODE==='postgres'&&process.env.PLATFORM_INTELLIGENCE_ENABLED==='true'&&process.env.PLATFORM_INTELLIGENCE_PERSISTENCE_ENABLED==='true';}
