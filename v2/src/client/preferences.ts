import type { Theme } from './ui/kit';

export type InterfacePreferences = { theme: Theme; scale: 'small' | 'normal' | 'large'; density: 'comfortable' | 'normal' | 'compact'; sidebar: 'wide' | 'narrow' };
export const defaultInterfacePreferences: InterfacePreferences = { theme: 'dark', scale: 'normal', density: 'normal', sidebar: 'wide' };

export function interfacePreferences(value: unknown): InterfacePreferences {
  const preferences = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (Object.hasOwn(preferences, 'interface') && preferences.interface === null) return defaultInterfacePreferences;
  const legacy = preferences.v1 && typeof preferences.v1 === 'object' ? preferences.v1 as Record<string, unknown> : {};
  const source = preferences.interface ?? legacy.interfacePreferences;
  const input = source && typeof source === 'object' && !Array.isArray(source) ? source as Record<string, unknown> : {};
  return {
    theme: input.theme === 'light' || input.theme === 'system' ? input.theme : 'dark',
    scale: input.scale === 'small' || input.scale === 'large' ? input.scale : 'normal',
    density: input.density === 'comfortable' || input.density === 'compact' ? input.density : 'normal',
    sidebar: input.sidebar === 'narrow' ? 'narrow' : 'wide',
  };
}
