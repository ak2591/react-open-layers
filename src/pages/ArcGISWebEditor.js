import React, { useState, useEffect, useRef } from 'react';

// OpenLayers imports
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import { fromLonLat, toLonLat } from 'ol/proj';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import CircleStyle from 'ol/style/Circle';
import TextStyle from 'ol/style/Text';
import Select from 'ol/interaction/Select';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import { click } from 'ol/events/condition';
import { defaults as defaultControls } from 'ol/control';
import ScaleLine from 'ol/control/ScaleLine';

import 'ol/ol.css';
import '../styles/ArcGISWebEditor.css';

/* ═══════════════════════════════════════════════════════════════
   SVG ICON PRIMITIVES
═══════════════════════════════════════════════════════════════ */
const Svg = ({ size = 16, vb = '0 0 24 24', children, style, ...p }) => (
  <svg
    width={size} height={size} viewBox={vb}
    fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    style={style} {...p}
  >
    {children}
  </svg>
);

const Ico = {
  Menu:     () => <Svg><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></Svg>,
  Bell:     () => <Svg><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Svg>,
  Search:   () => <Svg><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Svg>,
  Save:     () => <Svg><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></Svg>,
  Share:    () => <Svg><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></Svg>,
  Layers:   () => <Svg><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></Svg>,
  Home:     () => <Svg><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Svg>,
  Filter:   () => <Svg><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Svg>,
  Trash:    () => <Svg><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Svg>,
  Copy:     () => <Svg><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Svg>,
  Undo:     () => <Svg><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/></Svg>,
  Redo:     () => <Svg><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4.02"/></Svg>,
  Measure:  () => <Svg><line x1="2" y1="12" x2="22" y2="12"/><polyline points="7 7 2 12 7 17"/><polyline points="17 7 22 12 17 17"/></Svg>,
  Bookmark: () => <Svg><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></Svg>,
  Legend:   () => <Svg><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></Svg>,
  Settings: () => <Svg><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Svg>,
  Plus:     () => <Svg><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>,
  Minus:    () => <Svg><line x1="5" y1="12" x2="19" y2="12"/></Svg>,
  Grid4:    () => <Svg><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Svg>,
  Table:    () => <Svg><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/></Svg>,
  Upload:   () => <Svg><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></Svg>,
  Map:      () => <Svg><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></Svg>,
  Select:   () => <Svg><path d="M4 4l5 14 3-6 6-3z"/><line x1="10.5" y1="10.5" x2="20" y2="20"/></Svg>,
  Waffle:   () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="4" height="4" rx=".5"/><rect x="10" y="3" width="4" height="4" rx=".5"/>
      <rect x="17" y="3" width="4" height="4" rx=".5"/><rect x="3" y="10" width="4" height="4" rx=".5"/>
      <rect x="10" y="10" width="4" height="4" rx=".5"/><rect x="17" y="10" width="4" height="4" rx=".5"/>
      <rect x="3" y="17" width="4" height="4" rx=".5"/><rect x="10" y="17" width="4" height="4" rx=".5"/>
      <rect x="17" y="17" width="4" height="4" rx=".5"/>
    </svg>
  ),
  Cut:      () => <Svg><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></Svg>,
  Merge:    () => <Svg><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="8" y="14" width="8" height="8" rx="1"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="6" y1="10" x2="12" y2="14"/><line x1="18" y1="10" x2="12" y2="14"/></Svg>,
  Reshape:  () => <Svg><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></Svg>,
  Vertex:   () => <Svg><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><polyline points="12 8 5 16 19 16 12 8"/></Svg>,
  Rotate:   () => <Svg><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></Svg>,
  Attribute:() => <Svg><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><rect x="2" y="4" width="4" height="4"/><rect x="2" y="10" width="4" height="4"/><rect x="2" y="16" width="4" height="4"/></Svg>,
  BarChart: () => <Svg><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></Svg>,
  ChevronU: () => <Svg><polyline points="18 15 12 9 6 15"/></Svg>,
  ChevronD: () => <Svg><polyline points="6 9 12 15 18 9"/></Svg>,
  ChevronL: () => <Svg><polyline points="15 18 9 12 15 6"/></Svg>,
  ChevronR: () => <Svg><polyline points="9 18 15 12 9 6"/></Svg>,
  Point: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" fill="rgba(0,121,193,0.25)"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
      <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
    </svg>
  ),
  Line: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="4" y1="20" x2="20" y2="4"/>
      <circle cx="4" cy="20" r="2.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
      <circle cx="20" cy="4" r="2.5" fill="currentColor"/>
    </svg>
  ),
  Polygon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12,2 21,8 18,20 6,20 3,8" fill="rgba(0,121,193,0.15)"/>
      <circle cx="12" cy="2" r="2" fill="currentColor"/>
      <circle cx="21" cy="8" r="2" fill="currentColor"/>
      <circle cx="18" cy="20" r="2" fill="currentColor"/>
      <circle cx="6" cy="20" r="2" fill="currentColor"/>
      <circle cx="3" cy="8" r="2" fill="currentColor"/>
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const LAYER_DATA = [
  { id: 'poi',       name: 'Points of Interest', type: 'point',   color: '#e84d3d', vis: true  },
  { id: 'roads',     name: 'Road Network',        type: 'line',    color: '#ff8c00', vis: true  },
  { id: 'parks',     name: 'Parks & Green Space', type: 'polygon', color: '#38a169', vis: true  },
  { id: 'buildings', name: 'Buildings',           type: 'polygon', color: '#6366f1', vis: false },
  { id: 'basemap',   name: 'World Topo Map',      type: 'basemap', color: '#718096', vis: true  },
];

const BASEMAPS = [
  { name: 'World Topo',  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',                   thumb: '#c8e6c9' },
  { name: 'Imagery',     url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',                    thumb: '#263238' },
  { name: 'Streets',     url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',                 thumb: '#e3f2fd' },
  { name: 'Ocean',       url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',           thumb: '#1565c0' },
  { name: 'Dark Gray',   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',      thumb: '#37474f' },
  { name: 'Light Gray',  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',     thumb: '#eceff1' },
];

const TOOL_NAMES = {
  select: 'Select Features',
  'draw-point': 'Draw Point',
  'draw-line': 'Draw Line',
  'draw-polygon': 'Draw Polygon',
  'edit-vertex': 'Edit Vertices',
  reshape: 'Reshape',
  cut: 'Split/Cut',
  merge: 'Merge Features',
  rotate: 'Rotate',
};

/* ═══════════════════════════════════════════════════════════════
   TOOLBAR BUTTON
═══════════════════════════════════════════════════════════════ */
function TBtn({ icon, label, active = false, onClick, disabled = false }) {
  const [hov, setHov] = useState(false);
  const bg      = active ? '#e8f2fa' : hov ? '#f0f0f0' : 'transparent';
  const color   = active ? '#0079c1' : disabled ? '#bbb' : '#555';
  const borderL = active ? '2px solid #0079c1' : '2px solid transparent';

  return (
    <button
      data-tip={label}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 34, height: 34, borderRadius: 2,
        background: bg, color, borderLeft: borderL,
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all .12s', flexShrink: 0, padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {icon}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR ICON BUTTON
═══════════════════════════════════════════════════════════════ */
function SBtn({ icon, label, active = false, onClick }) {
  const [hov, setHov] = useState(false);
  const bg    = active ? '#0079c1' : hov ? 'rgba(255,255,255,0.1)' : 'transparent';
  const color = active ? '#fff' : '#adb5bd';

  return (
    <button
      data-tip={label}
      className="tip-right"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', height: 42, background: bg, color,
        borderRadius: 0, border: 'none', cursor: 'pointer',
        borderLeft: active ? '3px solid #fff' : '3px solid transparent',
        transition: 'all .12s', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {icon}
    </button>
  );
}

/* Toolbar Divider */
const TDiv = () => (
  <div style={{ width: 1, height: 22, background: '#d0d0d0', margin: '0 4px', flexShrink: 0 }} />
);

/* ═══════════════════════════════════════════════════════════════
   HEADER
═══════════════════════════════════════════════════════════════ */
function Header({ setSidebarOpen }) {
  return (
    <header className="app-header">
      {/* Hamburger */}
      <button className="header-hamburger" onClick={() => setSidebarOpen(v => !v)}>
        <Ico.Menu />
      </button>

      {/* Logo + Title */}
      <div className="header-brand">
        <svg width="24" height="24" viewBox="0 0 32 32">
          <defs>
            <linearGradient id="esriGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0079c1" />
              <stop offset="100%" stopColor="#00a9e0" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="16" fill="url(#esriGrad)" />
          <text x="16" y="22" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="Arial">
            GIS
          </text>
        </svg>
        <span className="header-title">ArcGIS Web Editor</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right Controls */}
      <div className="header-right">
        <button data-tip="Compact view" className="header-icon-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        </button>
        <button data-tip="Split view" className="header-icon-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="8" height="18" rx="1" />
            <rect x="13" y="3" width="8" height="18" rx="1" />
          </svg>
        </button>

        <div className="header-divider" />

        <button data-tip="Notifications" className="header-icon-btn" style={{ position: 'relative' }}>
          <Ico.Bell />
          <span className="notif-dot" />
        </button>

        <button data-tip="App launcher" className="header-icon-btn">
          <Ico.Waffle />
        </button>

        <div data-tip="My profile" className="user-avatar">U</div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL CONTENT COMPONENTS
═══════════════════════════════════════════════════════════════ */
function LayersPanel() {
  const [layers, setLayers] = useState(LAYER_DATA);
  const toggle = (id) => setLayers(ls => ls.map(l => l.id === id ? { ...l, vis: !l.vis } : l));

  return (
    <div className="panel-scroll">
      {layers.map(l => (
        <div key={l.id} className="layer-row-item">
          <div
            className="layer-swatch"
            style={{
              background: l.color,
              borderRadius: l.type === 'point' ? '50%' : 2,
              opacity: l.vis ? 1 : 0.35,
            }}
          />
          <span className="layer-row-name" style={{ color: l.vis ? '#333' : '#aaa' }}>
            {l.name}
          </span>
          <button onClick={() => toggle(l.id)} className="layer-eye-btn" style={{ color: l.vis ? '#555' : '#ccc' }}>
            {l.vis ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

function LegendPanel() {
  return (
    <div className="panel-scroll">
      {LAYER_DATA.filter(l => l.id !== 'basemap').map(l => (
        <div key={l.id} className="legend-row">
          <div
            style={{
              width: 16, height: 16, flexShrink: 0,
              borderRadius: l.type === 'point' ? '50%' : l.type === 'line' ? 0 : 2,
              background: l.type === 'line' ? 'transparent' : l.color,
              borderBottom: l.type === 'line' ? `3px solid ${l.color}` : 'none',
            }}
          />
          <span style={{ fontSize: 12, color: '#333' }}>{l.name}</span>
        </div>
      ))}
    </div>
  );
}

function ContentPanel() {
  const items = ['Layers (4)', 'Tables (0)', 'Bookmarks (2)', 'Pop-ups', 'Labels', 'Ground Measures'];
  return (
    <div>
      {items.map(it => (
        <div key={it} className="content-row">
          {it}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      ))}
    </div>
  );
}

function PanelContent({ type }) {
  if (type === 'layers')  return <LayersPanel />;
  if (type === 'legend')  return <LegendPanel />;
  if (type === 'content') return <ContentPanel />;
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#999' }}>
      <div style={{ marginBottom: 8 }}><Ico.Settings /></div>
      <p style={{ fontSize: 12 }}>{type} panel</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEFT SIDEBAR
═══════════════════════════════════════════════════════════════ */
function LeftSidebar({ active, setActive }) {
  const topItems = [
    { id: 'content',  icon: <Ico.Home />,     label: 'Content'   },
    { id: 'layers',   icon: <Ico.Layers />,   label: 'Layers'    },
    { id: 'legend',   icon: <Ico.Legend />,   label: 'Legend'    },
    { id: 'filter',   icon: <Ico.Filter />,   label: 'Filter'    },
    { id: 'measure',  icon: <Ico.Measure />,  label: 'Measure'   },
    { id: 'bookmark', icon: <Ico.Bookmark />, label: 'Bookmarks' },
  ];
  const bottomItems = [
    { id: 'settings', icon: <Ico.Settings />, label: 'Settings' },
  ];

  return (
    <div className="sidebar-wrap">
      {/* Icon Rail */}
      <div className="icon-rail">
        <div style={{ flex: 1 }}>
          {topItems.map(it => (
            <SBtn
              key={it.id} icon={it.icon} label={it.label}
              active={active === it.id}
              onClick={() => setActive(active === it.id ? null : it.id)}
            />
          ))}
        </div>
        <div>
          {bottomItems.map(it => (
            <SBtn
              key={it.id} icon={it.icon} label={it.label}
              active={active === it.id}
              onClick={() => setActive(active === it.id ? null : it.id)}
            />
          ))}
          <div className="rail-sep" />
          <button className="rail-collapse-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="11 17 6 12 11 7" />
              <polyline points="18 17 13 12 18 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Slide-out Panel */}
      {active && (
        <div className="slide-panel">
          <div className="slide-panel-header">
            <span className="slide-panel-title">{active}</span>
            <button onClick={() => setActive(null)} className="slide-panel-close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <PanelContent type={active} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOOLBAR
═══════════════════════════════════════════════════════════════ */
function Toolbar({ activeTool, setActiveTool }) {
  const tool = (id) => ({
    active: activeTool === id,
    onClick: () => setActiveTool(id),
  });

  return (
    <div className="toolbar">
      {/* Group 1 – Content */}
      <TBtn icon={<Ico.Map />}    label="Map Viewer"      onClick={() => {}} />
      <TBtn icon={<Ico.Table />}  label="Attribute Table" onClick={() => {}} />
      <TBtn icon={<Ico.Upload />} label="Add Data"        onClick={() => {}} />
      <TDiv />

      {/* Group 2 – Editing */}
      <TBtn icon={<Ico.Select />}   label="Select Features (S)"  {...tool('select')} />
      <TBtn icon={<Ico.Point />}    label="Draw Point"           {...tool('draw-point')} />
      <TBtn icon={<Ico.Line />}     label="Draw Line"            {...tool('draw-line')} />
      <TBtn icon={<Ico.Polygon />}  label="Draw Polygon"         {...tool('draw-polygon')} />
      <TBtn icon={<Ico.Vertex />}   label="Edit Vertices"        {...tool('edit-vertex')} />
      <TBtn icon={<Ico.Reshape />}  label="Reshape"              {...tool('reshape')} />
      <TBtn icon={<Ico.Cut />}      label="Split / Cut"          {...tool('cut')} />
      <TBtn icon={<Ico.Merge />}    label="Merge Features"       {...tool('merge')} />
      <TBtn icon={<Ico.Rotate />}   label="Rotate"               {...tool('rotate')} />
      <TBtn icon={<Ico.Trash />}    label="Delete Selected"      onClick={() => {}} />
      <TDiv />

      {/* Group 3 – Analysis */}
      <TBtn icon={<Ico.Attribute />} label="Attributes" onClick={() => {}} />
      <TBtn icon={<Ico.BarChart />}  label="Analysis"   onClick={() => {}} />
      <TDiv />

      {/* Group 4 – Actions */}
      <TBtn icon={<Ico.Copy />} label="Copy"         onClick={() => {}} />
      <TBtn icon={<Ico.Undo />} label="Undo (Ctrl+Z)" onClick={() => {}} />
      <TBtn icon={<Ico.Redo />} label="Redo (Ctrl+Y)" onClick={() => {}} />

      <div style={{ flex: 1 }} />

      <TBtn icon={<Ico.Save />}   label="Save Map" onClick={() => {}} />
      <TBtn icon={<Ico.Share />}  label="Share"    onClick={() => {}} />
      <TBtn icon={<Ico.Search />} label="Search"   onClick={() => {}} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION WIDGET
═══════════════════════════════════════════════════════════════ */
function NavWidget({ mapRef }) {
  const panBy = (dx, dy) => {
    const m = mapRef.current;
    if (!m) return;
    const v   = m.getView();
    const c   = v.getCenter();
    const res = v.getResolution();
    v.animate({ center: [c[0] + dx * res * 80, c[1] + dy * res * 80], duration: 180 });
  };

  const zoom = (delta) => {
    const m = mapRef.current;
    if (!m) return;
    m.getView().animate({ zoom: m.getView().getZoom() + delta, duration: 200 });
  };

  return (
    <div className="nav-widget">
      {/* Arrow Pad */}
      <div className="arrow-pad">
        <div />
        <button className="nav-btn" onClick={() => panBy(0, 1)}  title="Pan North"><Ico.ChevronU /></button>
        <div />
        <button className="nav-btn" onClick={() => panBy(-1, 0)} title="Pan West"><Ico.ChevronL /></button>
        <button className="nav-btn nav-btn-center" title="Center">
          <div className="nav-center-dot" />
        </button>
        <button className="nav-btn" onClick={() => panBy(1, 0)}  title="Pan East"><Ico.ChevronR /></button>
        <div />
        <button className="nav-btn" onClick={() => panBy(0, -1)} title="Pan South"><Ico.ChevronD /></button>
        <div />
      </div>

      {/* Zoom Buttons */}
      <div className="zoom-btns">
        <button className="nav-btn" onClick={() => zoom(1)}  title="Zoom In"><Ico.Plus /></button>
        <div className="zoom-sep" />
        <button className="nav-btn" onClick={() => zoom(-1)} title="Zoom Out"><Ico.Minus /></button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BASEMAP WIDGET
═══════════════════════════════════════════════════════════════ */
function BasemapWidget({ mapRef }) {
  const [showGallery, setShowGallery] = useState(false);
  const [activeBase,  setActiveBase]  = useState(0);

  const switchBase = (i) => {
    setActiveBase(i);
    setShowGallery(false);
    const m = mapRef?.current;
    if (!m) return;
    const newTile = new TileLayer({
      source: new XYZ({ url: BASEMAPS[i].url, maxZoom: 19 }),
      className: 'basemap',
    });
    m.getLayers().setAt(0, newTile);
  };

  return (
    <div className="basemap-widget">
      {showGallery && (
        <div className="basemap-gallery">
          <p className="gallery-title">Basemap Gallery</p>
          <div className="gallery-grid">
            {BASEMAPS.map((b, i) => (
              <button key={i} onClick={() => switchBase(i)} className={`gallery-item ${activeBase === i ? 'active' : ''}`}>
                <div className="gallery-thumb" style={{ background: b.thumb }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  </svg>
                </div>
                <div className="gallery-name">{b.name}</div>
                {activeBase === i && (
                  <div className="gallery-check">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="basemap-controls">
        <button className="bm-btn" data-tip="Basemap Gallery" onClick={() => setShowGallery(v => !v)}>
          <Ico.Grid4 />
        </button>
        <button className="bm-btn" data-tip="Legend">
          <Ico.Legend />
        </button>
        <div className="bm-sep" />
        <button
          className="bm-btn" data-tip="Zoom In"
          onClick={() => mapRef?.current?.getView().animate({ zoom: mapRef.current.getView().getZoom() + 1, duration: 200 })}
        >
          <Ico.Plus />
        </button>
        <button
          className="bm-btn" data-tip="Zoom Out"
          onClick={() => mapRef?.current?.getView().animate({ zoom: mapRef.current.getView().getZoom() - 1, duration: 200 })}
        >
          <Ico.Minus />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH OVERLAY
═══════════════════════════════════════════════════════════════ */
function SearchOverlay() {
  const [val, setVal] = useState('');

  return (
    <div className="search-overlay">
      <div className="search-icon-wrap"><Ico.Search /></div>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="Search the map"
        className="search-input"
      />
      {val && (
        <button onClick={() => setVal('')} className="search-clear">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STATUS BAR (inside map)
═══════════════════════════════════════════════════════════════ */
function StatusBarInMap({ tool, zoom, coords }) {
  return (
    <div className="status-bar">
      <span className="status-tool">● {TOOL_NAMES[tool] || 'Select Features'}</span>
      <span className="status-sep">|</span>
      <span>Zoom: {zoom}</span>
      <div style={{ flex: 1 }} />
      <span className="status-coords">{coords}</span>
      <span className="status-sep">|</span>
      <span className="status-attribution">
        Sources: Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN ·{' '}
        Powered by <strong>Esri</strong>
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAP VIEW
═══════════════════════════════════════════════════════════════ */
function MapView({ activeTool, mapRef }) {
  const containerRef = useRef(null);
  const olLayersRef  = useRef({});
  const drawRef      = useRef(null);
  const selectRef    = useRef(null);
  const modifyRef    = useRef(null);

  const [coords, setCoords] = useState('Lon: –  Lat: –');
  const [zoom,   setZoom]   = useState('4.0');

  // ── Initialise OpenLayers Map ─────────────────────────────────
  useEffect(() => {
    const buildingFeatures = [
      { id: 'b1', name: 'Capitol', coords: [[-77.009, 38.890], [-77.005, 38.890], [-77.005, 38.887], [-77.009, 38.887]] },
      { id: 'b2', name: 'Museum',  coords: [[-77.022, 38.891], [-77.017, 38.891], [-77.017, 38.888], [-77.022, 38.888]] },
    ].map(fd => {
      const ring = fd.coords.map(c => fromLonLat(c));
      ring.push(ring[0]);
      const f = new Feature(new Polygon([ring]));
      f.setId(fd.id); f.set('name', fd.name);
      return f;
    });

    const roadFeatures = [
      { id: 'r1', name: 'Main Ave', coords: [[-77.05, 38.90], [-76.96, 38.90]] },
      { id: 'r2', name: 'Oak Blvd', coords: [[-77.00, 38.95], [-77.00, 38.85]] },
    ].map(fd => {
      const f = new Feature(new LineString(fd.coords.map(c => fromLonLat(c))));
      f.setId(fd.id); f.set('name', fd.name);
      return f;
    });

    const poiData = [
      [-77.0366, 38.8971, 'White House'],
      [-77.0090, 38.8897, 'Lincoln Memorial'],
      [-77.0232, 38.8895, 'Washington Monument'],
      [-77.0191, 38.8921, 'Jefferson Memorial'],
    ];
    const poiFeatures = poiData.map(([ln, lt, nm], i) => {
      const f = new Feature(new Point(fromLonLat([ln, lt])));
      f.setId('poi' + i); f.set('name', nm);
      return f;
    });

    const buildingLayer = new VectorLayer({
      source: new VectorSource({ features: buildingFeatures }),
      style: new Style({
        fill:   new Fill({ color: 'rgba(99,102,241,0.3)' }),
        stroke: new Stroke({ color: '#6366f1', width: 1.5 }),
      }),
    });

    const roadLayer = new VectorLayer({
      source: new VectorSource({ features: roadFeatures }),
      style: new Style({ stroke: new Stroke({ color: '#ff8c00', width: 3 }) }),
    });

    const poiLayer = new VectorLayer({
      source: new VectorSource({ features: poiFeatures }),
      style: (f) => [
        new Style({
          image: new CircleStyle({
            radius: 7,
            fill:   new Fill({ color: '#e84d3d' }),
            stroke: new Stroke({ color: '#fff', width: 1.5 }),
          }),
        }),
        new Style({
          text: new TextStyle({
            text:      f.get('name'),
            font:      '11px Arial',
            fill:      new Fill({ color: '#222' }),
            stroke:    new Stroke({ color: '#fff', width: 3 }),
            offsetY:   -14,
          }),
        }),
      ],
    });

    olLayersRef.current = { buildings: buildingLayer, roads: roadLayer, poi: poiLayer };

    const map = new Map({
      target: containerRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            maxZoom: 19,
            attributions: 'Sources: Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
          }),
          className: 'basemap',
        }),
        buildingLayer,
        roadLayer,
        poiLayer,
      ],
      view: new View({ center: fromLonLat([-98, 39]), zoom: 4, minZoom: 2, maxZoom: 19 }),
      controls: defaultControls({ zoom: false }).extend([new ScaleLine({ units: 'metric' })]),
    });

    mapRef.current = map;

    map.on('pointermove', (e) => {
      const [ln, lt] = toLonLat(e.coordinate);
      setCoords(`Lon: ${ln.toFixed(4)}  Lat: ${lt.toFixed(4)}`);
    });

    map.getView().on('change:resolution', () => {
      setZoom(map.getView().getZoom().toFixed(1));
    });

    return () => map.setTarget(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tool Switching ────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    if (drawRef.current)   { m.removeInteraction(drawRef.current);   drawRef.current = null; }
    if (selectRef.current) { m.removeInteraction(selectRef.current); selectRef.current = null; }
    if (modifyRef.current) { m.removeInteraction(modifyRef.current); modifyRef.current = null; }

    m.getTargetElement().style.cursor = activeTool.startsWith('draw') ? 'crosshair' : '';

    if (activeTool === 'select') {
      const sel = new Select({ condition: click });
      m.addInteraction(sel);
      selectRef.current = sel;
    }

    if (activeTool === 'edit-vertex') {
      const layers = Object.values(olLayersRef.current);
      const sel = new Select({ layers });
      const mod = new Modify({ source: layers[0].getSource() });
      m.addInteraction(sel);
      m.addInteraction(mod);
      selectRef.current = sel;
      modifyRef.current = mod;
    }

    const drawTypeMap = {
      'draw-point':   'Point',
      'draw-line':    'LineString',
      'draw-polygon': 'Polygon',
    };

    if (drawTypeMap[activeTool]) {
      const { poi, roads, buildings } = olLayersRef.current;
      const src =
        activeTool === 'draw-point'   ? poi?.getSource()       :
        activeTool === 'draw-line'    ? roads?.getSource()     :
        buildings?.getSource();

      if (src) {
        const draw = new Draw({ source: src, type: drawTypeMap[activeTool] });
        m.addInteraction(draw);
        drawRef.current = draw;
      }
    }
  }, [activeTool]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <SearchOverlay />
      <NavWidget mapRef={mapRef} />
      <BasemapWidget mapRef={mapRef} />
      <StatusBarInMap tool={activeTool} zoom={zoom} coords={coords} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT APP  (default export)
═══════════════════════════════════════════════════════════════ */
export default function ArcGISWebEditor() {
  const [activeTool,  setActiveTool]  = useState('select');
  const [activePanel, setActivePanel] = useState('layers');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const mapRef = useRef(null);

  return (
    <div className="app-root">
      <Header setSidebarOpen={setSidebarOpen} />

      <div className="app-body">
        {sidebarOpen && (
          <LeftSidebar active={activePanel} setActive={setActivePanel} />
        )}
        <div className="map-column">
          <Toolbar activeTool={activeTool} setActiveTool={setActiveTool} />
          <MapView activeTool={activeTool} mapRef={mapRef} />
        </div>
      </div>
    </div>
  );
}
