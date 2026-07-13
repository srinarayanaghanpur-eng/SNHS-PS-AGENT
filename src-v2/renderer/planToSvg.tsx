// Renders a composition Plan to SVG for the live preview. Uses the very same
// composePoster() the Photoshop pipeline uses, so the preview mirrors the final
// poster's layout, hierarchy and colours, including real local image assets.

import React from 'react';
import type { Plan, PlanNode } from '../main/design/types';

const hex = (h: string) => `#${h}`;

function GradientDef({ id, stops, angle }: { id: string; stops: { hex: string; position: number }[]; angle: number }) {
  const rad = (angle * Math.PI) / 180;
  const x2 = Math.round(50 + Math.cos(rad) * 50); const y2 = Math.round(50 + Math.sin(rad) * 50);
  const x1 = 100 - x2; const y1 = 100 - y2;
  return (
    <linearGradient id={id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
      {stops.map((s, i) => <stop key={i} offset={`${s.position}%`} stopColor={hex(s.hex)} />)}
    </linearGradient>
  );
}

function localFileUrl(path: string): string {
  return encodeURI(`file:///${path.replace(/\\/g, '/')}`);
}

function Node({ node, gi, ni }: { node: PlanNode; gi: number; ni: number }) {
  const id = `g${gi}_${ni}`;
  if (node.kind === 'rect') {
    return <rect x={node.rect.x} y={node.rect.y} width={node.rect.w} height={node.rect.h} rx={node.radius ?? 0} fill={hex(node.hex)} opacity={(node.opacity ?? 100) / 100} />;
  }
  if (node.kind === 'ellipse') {
    return <ellipse cx={node.rect.x + node.rect.w / 2} cy={node.rect.y + node.rect.h / 2} rx={node.rect.w / 2} ry={node.rect.h / 2} fill={hex(node.hex)} opacity={(node.opacity ?? 100) / 100} />;
  }
  if (node.kind === 'gradient') {
    return (
      <g>
        <defs><GradientDef id={id} stops={node.stops} angle={node.angle} /></defs>
        <rect x={node.rect.x} y={node.rect.y} width={node.rect.w} height={node.rect.h} fill={`url(#${id})`} opacity={(node.opacity ?? 100) / 100} />
      </g>
    );
  }
  if (node.kind === 'photo') {
    const clipId = `clip_${id}`;
    return (
      <g>
        <defs>
          <clipPath id={clipId}>
            {node.mask === 'circle'
              ? <ellipse cx={node.rect.x + node.rect.w / 2} cy={node.rect.y + node.rect.h / 2} rx={node.rect.w / 2} ry={node.rect.h / 2} />
              : <rect x={node.rect.x} y={node.rect.y} width={node.rect.w} height={node.rect.h} rx={node.mask === 'rounded' ? (node.radius ?? 18) : 0} />}
          </clipPath>
        </defs>
        <image href={localFileUrl(node.path)} x={node.rect.x} y={node.rect.y} width={node.rect.w} height={node.rect.h}
          preserveAspectRatio={node.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'} clipPath={`url(#${clipId})`} />
      </g>
    );
  }
  // text
  const lines = node.content.split('\r');
  const anchor = node.align === 'center' ? 'middle' : node.align === 'right' ? 'end' : 'start';
  const tx = node.align === 'center' ? node.rect.x + node.rect.w / 2 : node.align === 'right' ? node.rect.x + node.rect.w : node.rect.x;
  const lh = node.size * (node.lineHeight ?? 1.2);
  return (
    <text x={tx} y={node.rect.y + node.size} fontSize={node.size} fill={hex(node.hex)} textAnchor={anchor}
      fontWeight={/TITLE|HEADLINE|NAME|BADGE|Bold|Black|Impact/.test(node.name + node.font) ? 700 : 400}
      fontFamily={/Georgia|Palatino|Times/.test(node.font) ? 'Georgia, serif' : 'Arial, sans-serif'}
      style={{ letterSpacing: node.tracking ? node.tracking / 20 : undefined }}>
      {lines.map((ln, i) => <tspan key={i} x={tx} dy={i === 0 ? 0 : lh}>{ln}</tspan>)}
    </text>
  );
}

export function PlanSvg({ plan, showGuides }: { plan: Plan; showGuides?: boolean }) {
  const m = { x: Math.round(plan.width * 0.055), y: Math.round(plan.height * 0.047) };
  return (
    <svg viewBox={`0 0 ${plan.width} ${plan.height}`} width="100%" style={{ display: 'block', background: '#fff' }} preserveAspectRatio="xMidYMid meet">
      {plan.groups.map((group, gi) => (
        <g key={gi} opacity={(group.opacity ?? 100) / 100} data-group={group.name}>
          {group.nodes.map((node, ni) => <Node key={ni} node={node} gi={gi} ni={ni} />)}
        </g>
      ))}
      {showGuides && (
        <g>
          <rect x={m.x} y={m.y} width={plan.width - 2 * m.x} height={plan.height - 2 * m.y} fill="none" stroke="#28c76f" strokeWidth={2} strokeDasharray="10 8" opacity={0.7} />
        </g>
      )}
    </svg>
  );
}
