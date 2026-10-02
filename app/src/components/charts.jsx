import { useRef, useState } from 'react';

/* رسوم بيانية خفيفة بـ SVG — بلا مكتبات خارجية
   - خطوط رفيعة، أطراف مستديرة، فواصل 2px، تسميات مباشرة للقيم، تلميح عند المرور */

function Tip({ tip }) {
  if (!tip) return null;
  return <div className="chart-tip" style={{ left: tip.x, top: tip.y }}><b>{tip.title}</b><span>{tip.body}</span></div>;
}

// أعمدة عمودية — سلسلة واحدة
export function BarChart({ data: raw, color = 'var(--purple-2)', height = 190, unit = '', rtl = true }) {
  const [tip, setTip] = useState(null);
  const data = rtl ? [...raw].reverse() : raw;
  const W = 520, H = height, padT = 22, padB = 38, padX = 12;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length; const slot = (W - padX * 2) / n; const bw = Math.min(56, slot * 0.58);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  return (
    <div className="chart" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="رسم بياني بالأعمدة" style={{ direction: 'ltr' }}>
        <line x1={padX} x2={W - padX} y1={H - padB} y2={H - padB} stroke="var(--line-strong)" />
        {data.map((d, i) => {
          const cx = padX + slot * i + slot / 2; const top = y(d.value); const h = H - padB - top;
          return (
            <g key={i}>
              <rect x={cx - slot / 2} y={padT - 10} width={slot} height={H - padT - padB + 10} fill="transparent"
                onMouseMove={(e) => { const r = e.currentTarget.ownerSVGElement.getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: e.clientY - r.top - 8, title: d.label, body: `${d.value} ${unit}` }); }} />
              {d.value > 0 && <path pointerEvents="none" fill={d.color || color}
                d={`M${cx - bw / 2},${H - padB} V${top + 4} q0,-4 4,-4 H${cx + bw / 2 - 4} q4,0 4,4 V${H - padB} Z`} />}
              <text x={cx} y={top - 6} textAnchor="middle" className="chart-val">{d.value}</text>
              <text x={cx} y={H - padB + 16} textAnchor="middle" className="chart-lbl">{d.icon || ''}</text>
              <text x={cx} y={H - padB + 31} textAnchor="middle" className="chart-lbl">{d.short || d.label}</text>
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

// أشرطة أفقية لفئات ملونة (مع تسمية مباشرة لكل فئة)
export function HBars({ data, unit = '' }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hbars">
      {data.map((d) => (
        <div className="hbar" key={d.label} title={`${d.label}: ${d.value} ${unit}`}>
          <div className="hbar-lbl"><i className="dot" style={{ background: d.color }} />{d.label}</div>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} /></div>
          <div className="hbar-val">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

// خط زمني — سلسلة واحدة مع مؤشر تتبع
export function LineChart({ data, color = 'var(--gold)', height = 190, unit = '', rtl = true }) {
  const [hi, setHi] = useState(null);
  const ref = useRef(null);
  const W = 520, H = height, padT = 18, padB = 30, padL = rtl ? 14 : 30, padR = rtl ? 30 : 14;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const x0 = (i) => padL + (n <= 1 ? 0 : ((W - padL - padR) * i) / (n - 1));
  const x = (i) => rtl ? W - x0(i) : x0(i);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ');
  const area = `${line} L${x(n - 1)},${H - padB} L${x(0)},${H - padB} Z`;
  const ticks = [0, Math.round(max / 2), max];
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0; data.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    setHi(best);
  };
  const tipPos = hi !== null && ref.current ? (() => { const r = ref.current.getBoundingClientRect(); return { x: (x(hi) / W) * r.width, y: (y(data[hi].value) / H) * r.height - 10 }; })() : null;
  return (
    <div className="chart" onMouseLeave={() => setHi(null)}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} role="img" aria-label="تطور النقاط بمرور الوقت" style={{ direction: 'ltr' }}>
        <defs><linearGradient id="lg-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {ticks.map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" /><text x={rtl ? W - padR + 6 : padL - 6} y={y(t) + 4} textAnchor={rtl ? 'start' : 'end'} className="chart-lbl">{t}</text></g>)}
        <path d={area} fill="url(#lg-area)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (i === n - 1 || i % Math.ceil(n / 6) === 0) && <text key={i} x={x(i)} y={H - 10} textAnchor="middle" className="chart-lbl">{d.label}</text>)}
        {n > 0 && <text x={x(n - 1)} y={y(data[n - 1].value) - 10} textAnchor={rtl ? 'start' : 'end'} className="chart-val">{data[n - 1].value}</text>}
        {hi !== null && <g pointerEvents="none">
          <line x1={x(hi)} x2={x(hi)} y1={padT} y2={H - padB} stroke="var(--muted)" strokeDasharray="3 3" />
          <circle cx={x(hi)} cy={y(data[hi].value)} r="5" fill={color} stroke="#fff" strokeWidth="2" />
        </g>}
      </svg>
      {tipPos && <Tip tip={{ ...tipPos, title: data[hi].full || data[hi].label, body: `${data[hi].value} ${unit}` }} />}
    </div>
  );
}

// حلقة نسبة
export function Ring({ pct, size = 120, color = 'var(--gold)', label }) {
  const r = (size - 14) / 2, c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth="10" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={`${(c * Math.min(100, pct)) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-txt"><b>{pct}%</b>{label && <small>{label}</small>}</div>
    </div>
  );
}
