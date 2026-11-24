import { useState, type ReactNode } from 'react';
export function Appear({ children }: { children: ReactNode }) { return <div className="appear">{children}</div>; }
export function Shimmer() { return <div className="shimmer" aria-label="Yükleniyor"/>; }
export function Pop({ children }: { children: ReactNode }) { return <span className="pop">{children}</span>; }
export function Float({ children }: { children: ReactNode }) { return <div className="float">{children}</div>; }
export function usePressScale() { const [pressed, setPressed] = useState(false); return { style: { transform: pressed ? 'scale(.97)' : undefined }, onPointerDown: () => setPressed(true), onPointerUp: () => setPressed(false), onPointerLeave: () => setPressed(false) }; }
