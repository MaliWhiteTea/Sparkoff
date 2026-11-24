export function GraphyLine({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const points = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${100 - (v / max) * 90}`).join(' ');
  return <svg className="graph" role="img" aria-label={`${label}: ${values.join(', ')}`} viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>;
}
export function GraphyBars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  return <svg className="graph" role="img" aria-label={`${label}: ${values.join(', ')}`} viewBox="0 0 100 100" preserveAspectRatio="none">{values.map((v, i) => <rect key={i} x={i * (100 / values.length) + 1} y={100 - v / max * 90} width={Math.max(1, 100 / values.length - 2)} height={v / max * 90} rx="1" fill="currentColor"/>)}</svg>;
}
