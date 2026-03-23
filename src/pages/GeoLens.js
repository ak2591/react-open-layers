import { useState, useRef, useEffect, useCallback } from "react";
import "../styles/GeoLens.css";
import { useMapInit } from "../hooks/useMapInit";
import { useLayerLoader } from "../hooks/useLayerLoader";
import { useWfsEdit } from "../hooks/useWfsEdit";
import { toLonLat, transformExtent } from "ol/proj";
import { GEOSERVER_URL, getAuthHeaders } from "../config/geoserver";
import GeoJSON from "ol/format/GeoJSON";
import { getLength, getArea } from "ol/sphere";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Style from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import CircleStyle from "ol/style/Circle";
/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const OPERATIONAL_LAYERS = [
  {
    id: "poi",
    label: "Points of Interest",
    icon: "location_on",
    filled: true,
    defaultChecked: true,
  },
  {
    id: "roads",
    label: "Road Networks",
    icon: "conversion_path",
    filled: false,
    defaultChecked: true,
  },
  {
    id: "buildings",
    label: "Building Footprints",
    icon: "domain",
    filled: false,
    defaultChecked: false,
  },
];

const REFERENCE_LAYERS = [
  {
    id: "hydrology",
    label: "Hydrology",
    icon: "water_drop",
    filled: false,
    defaultChecked: false,
  },
  {
    id: "contour",
    label: "Contour Lines",
    icon: "terrain",
    filled: false,
    defaultChecked: false,
  },
];

const NAV_ITEMS = [
  { id: "content",  icon: "folder_open",         label: "Content"   },
  { id: "layers",   icon: "layers",              label: "Layers"    },
  { id: "legend",   icon: "format_list_bulleted", label: "Legend"    },
  { id: "measure",  icon: "straighten",          label: "Measure"   },
  { id: "bookmark", icon: "bookmark",            label: "Bookmarks" },
  { id: "spatial",  icon: "select_all",          label: "Spatial"   },
  { id: "filter",   icon: "filter_alt",          label: "Filter"    },
  { id: "settings", icon: "settings",            label: "Settings"  },
];

const TOOLS = [
  { id: "select", icon: "near_me", title: "Select", primary: true },
  { id: "draw-point", icon: "radio_button_checked", title: "Draw Point" },
  { id: "draw-line", icon: "timeline", title: "Draw Line" },
  { id: "draw-polygon", icon: "pentagon", title: "Draw Polygon" },
  { id: "edit", icon: "edit_square", title: "Edit Vertices" },
  { id: "cut", icon: "content_cut", title: "Cut" },
  { id: "merge", icon: "call_merge", title: "Merge" },
  { id: "delete", icon: "delete", title: "Delete", danger: true },
];

const TOOL_DIVIDERS = [0, 3]; // insert divider AFTER index 0 and index 3

const MEASURE_TOOLS = [
  { id: "linestring", icon: "timeline",    label: "Distance",  type: "distance" },
  { id: "circle",     icon: "circle",      label: "Circle",    type: "area"     },
  { id: "rectangle",  icon: "crop_square", label: "Rectangle", type: "area"     },
  { id: "polygon",    icon: "pentagon",    label: "Polygon",   type: "area"     },
  { id: "freehand",   icon: "gesture",     label: "Freeform",  type: "area"     },
];

const SPATIAL_TOOLS = [
  { id: "circle",    icon: "circle",      label: "Circle"    },
  { id: "rectangle", icon: "crop_square", label: "Rectangle" },
  { id: "polygon",   icon: "pentagon",    label: "Polygon"   },
  { id: "freehand",  icon: "gesture",     label: "Freeform"  },
];

const _geoFmt = new GeoJSON();

function calcMeasurement(feature) {
  const geom = feature?.geometry;
  if (!geom) return null;
  try {
    const olGeom = _geoFmt.readGeometry(geom, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });
    if (geom.type === "LineString" || geom.type === "MultiLineString") {
      const m = getLength(olGeom);
      return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
    }
    const sqm = getArea(olGeom);
    if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(2)} km²`;
    if (sqm >= 10_000)    return `${(sqm / 10_000).toFixed(2)} ha`;
    return `${Math.round(sqm)} m²`;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   SMALL REUSABLE COMPONENTS
═══════════════════════════════════════════════════════════════ */

/** Google Material Symbol icon */
function MI({ name, filled = false, className = "", style = {} }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontVariationSettings: filled
          ? "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"
          : undefined,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

/** Checkbox styled to match the original */
function LayerCheckbox({ checked, onChange }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="gl-checkbox"
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   HEADER
═══════════════════════════════════════════════════════════════ */
function Header() {
  return (
    <header className="gl-header">
      {/* Left: brand + nav */}
      <div className="gl-header-left">
        <span className="gl-brand">GeoLens</span>
        <nav className="gl-nav">
          <a href="#" className="gl-nav-link gl-nav-active">
            Web Editor
          </a>
          {/* <a href="#" className="gl-nav-link gl-nav-active">
            Projects
          </a>
          <a href="#" className="gl-nav-link gl-nav-inactive">
            Archive
          </a> */}
        </nav>
      </div>

      {/* Right: search + icons */}
      <div className="gl-header-right">
        <div className="gl-search-wrap">
          <input
            type="text"
            className="gl-search-input"
            placeholder="Search ..."
          />
          <MI name="search" className="gl-search-icon" />
        </div>
        <div className="gl-header-icons">
          <button className="gl-hdr-btn">
            <MI name="notifications" />
          </button>
          {/* <button className="gl-hdr-btn">
            <MI name="help" />
          </button> */}
          {/* <button className="gl-hdr-btn">
            <MI name="settings" />
          </button>
          <div className="gl-avatar">
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
              AK
            </span>
          </div> */}
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEFT NAV RAIL
═══════════════════════════════════════════════════════════════ */
function NavRail({ active, setActive }) {
  return (
    <aside className="gl-nav-rail">
      {/* Logo mark */}
      <div className="gl-rail-logo">
        <MI
          name="explore"
          style={{ fontSize: 28, color: "#6835d9", opacity: 0.4 }}
        />
      </div>

      {/* Top nav items */}
      <div className="gl-rail-items">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(active === item.id ? null : item.id)}
            className={`gl-rail-btn ${active === item.id ? "gl-rail-btn-active" : ""}`}
          >
            <MI
              name={item.icon}
              filled={active === item.id}
              className={
                active === item.id ? "gl-rail-icon-active" : "gl-rail-icon"
              }
            />
            <span className="gl-rail-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom items */}
      <div className="gl-rail-bottom">
        <button className="gl-rail-btn">
          <MI name="contact_support" className="gl-rail-icon" />
          <span className="gl-rail-label">Support</span>
        </button>
        <button className="gl-rail-btn">
          <MI name="account_circle" className="gl-rail-icon" />
          <span className="gl-rail-label">Account</span>
        </button>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LAYER MANAGER PANEL
═══════════════════════════════════════════════════════════════ */
function LayerManager({ layers, setLayers, geoLayers, geoVisibility, onToggleGeoLayer, wfsEditRef, activeEditLayerId }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = (id) => setLayers((prev) => ({ ...prev, [id]: !prev[id] }));

  const wmsLayers = geoLayers.filter((l) => l.group === "wms");
  const wfsLayers = geoLayers.filter((l) => l.group === "wfs");

  const handleEditClick = (e, layerId) => {
    e.stopPropagation();
    if (activeEditLayerId === layerId) {
      wfsEditRef?.current?.deactivate();
    } else {
      wfsEditRef?.current?.activate(layerId);
    }
  };

  const renderGeoLayer = (layer) => {
    const isEditing = layer.id === activeEditLayerId;
    return (
      <div
        key={layer.id}
        className={`gl-layer-row${isEditing ? " gl-layer-row--editing" : ""}`}
        onClick={() => onToggleGeoLayer(layer.id)}
        style={{ cursor: "pointer" }}
      >
        <div className="gl-layer-row-left">
          <MI
            name={layer.group === "wms" ? "map" : "scatter_plot"}
            className={isEditing ? "gl-layer-icon-active" : "gl-layer-icon"}
            style={{ fontSize: 20 }}
          />
          <span className="gl-layer-name">{layer.name}</span>
        </div>
        <div className="gl-layer-row-right" onClick={(e) => e.stopPropagation()}>
          {layer.group === "wfs" && (
            <button
              className={`gl-layer-edit-btn${isEditing ? " gl-layer-edit-btn--active" : ""}`}
              onClick={(e) => handleEditClick(e, layer.id)}
              title={isEditing ? "Exit edit mode" : "Edit this layer"}
            >
              <MI name={isEditing ? "edit_off" : "edit"} style={{ fontSize: 16 }} />
            </button>
          )}
          <LayerCheckbox
            checked={!!geoVisibility[layer.id]}
            onChange={() => onToggleGeoLayer(layer.id)}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={`gl-layer-panel${collapsed ? " gl-layer-panel--collapsed" : ""}`}>
      {/* Header */}
      <div className="gl-panel-header">
        {!collapsed && <h2 className="gl-panel-title">Layer Manager</h2>}
        <button className="gl-panel-collapse" onClick={() => setCollapsed((c) => !c)}>
          <MI
            name={collapsed ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"}
            className="gl-muted-icon"
          />
        </button>
      </div>

      {/* Layer list */}
      <div className="gl-panel-body">
        {/* Operational Layers */}
        {/* <section className="gl-layer-group">
          <h3 className="gl-group-label">Operational Layers</h3>
          <div className="gl-group-list">
            {OPERATIONAL_LAYERS.map((l) =>
              renderLayer(l, layers[l.id] && l.id === "poi"),
            )}
          </div>
        </section> */}

        {/* Reference Layers */}
        {/* <section className="gl-layer-group">
          <h3 className="gl-group-label">Reference Layers</h3>
          <div className="gl-group-list">
            {REFERENCE_LAYERS.map((l) => renderLayer(l, false))}
          </div>
        </section> */}

        {/* WMS Layers from GeoServer */}
        {wmsLayers.length > 0 && (
          <section className="gl-layer-group">
            <h3 className="gl-group-label">WMS Layers</h3>
            <div className="gl-group-list">
              {wmsLayers.map(renderGeoLayer)}
            </div>
          </section>
        )}

        {/* WFS Layers from GeoServer */}
        {wfsLayers.length > 0 && (
          <section className="gl-layer-group">
            <h3 className="gl-group-label">WFS Layers</h3>
            <div className="gl-group-list">
              {wfsLayers.map(renderGeoLayer)}
            </div>
          </section>
        )}
      </div>

      {/* Add Layer Button */}
      {/* <div className="gl-panel-footer">
        <button className="gl-add-layer-btn">
          <MI name="add_circle" style={{ fontSize: 18 }} />
          Add Data Layer
        </button>
      </div> */}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   LEGEND PANEL
═══════════════════════════════════════════════════════════════ */
function LegendSymbol({ layer }) {
  if (layer.group === "wms") {
    return (
      <img
        src={layer.legendUrl}
        alt={layer.name}
        className="gl-legend-img"
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }
  const isLine    = layer.geometryType?.includes("LineString");
  const isPolygon = layer.geometryType?.includes("Polygon");
  return (
    <span className="gl-legend-swatch-wrap">
      {isLine ? (
        <svg width="40" height="14" viewBox="0 0 40 14">
          <line x1="0" y1="7" x2="40" y2="7" stroke={layer.color} strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : isPolygon ? (
        <svg width="20" height="20" viewBox="0 0 20 20">
          <rect x="1" y="1" width="18" height="18" rx="3" fill={layer.color} fillOpacity="0.35" stroke={layer.color} strokeWidth="1.5" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7" fill={layer.color} stroke="#fff" strokeWidth="1.5" />
        </svg>
      )}
    </span>
  );
}

function LegendPanel({ geoLayers, geoVisibility }) {
  const [collapsed, setCollapsed] = useState(false);
  const wmsLayers = geoLayers.filter((l) => l.group === "wms");
  const wfsLayers = geoLayers.filter((l) => l.group === "wfs");

  const renderEntry = (layer) => (
    <div key={layer.id} className={`gl-legend-row${geoVisibility[layer.id] ? " gl-legend-row-active" : ""}`}>
      <span className="gl-legend-name">{layer.name}</span>
      <LegendSymbol layer={layer} />
    </div>
  );

  return (
    <div className={`gl-layer-panel${collapsed ? " gl-layer-panel--collapsed" : ""}`}>
      <div className="gl-panel-header">
        {!collapsed && <h2 className="gl-panel-title">Legend</h2>}
        <button className="gl-panel-collapse" onClick={() => setCollapsed((c) => !c)}>
          <MI
            name={collapsed ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"}
            className="gl-muted-icon"
          />
        </button>
      </div>
      <div className="gl-panel-body">
        {geoLayers.length === 0 && (
          <p className="gl-legend-empty">No layers loaded.</p>
        )}
        {wmsLayers.length > 0 && (
          <section className="gl-layer-group">
            <h3 className="gl-group-label">WMS Layers</h3>
            <div className="gl-group-list">{wmsLayers.map(renderEntry)}</div>
          </section>
        )}
        {wfsLayers.length > 0 && (
          <section className="gl-layer-group">
            <h3 className="gl-group-label">WFS Layers</h3>
            <div className="gl-group-list">{wfsLayers.map(renderEntry)}</div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MEASURE PANEL
═══════════════════════════════════════════════════════════════ */
const MEASURE_HINTS = {
  linestring: "Click to add points. Double-click to finish.",
  circle:     "Click to set centre, click again to set radius.",
  rectangle:  "Click to set one corner, click again to finish.",
  polygon:    "Click to add vertices. Click first point to close.",
  freehand:   "Click and drag to draw freehand.",
};

function MeasurePanel({ results, activeTool, onActivate, onClear }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`gl-layer-panel${collapsed ? " gl-layer-panel--collapsed" : ""}`}>
      {/* Header */}
      <div className="gl-panel-header">
        {!collapsed && <h2 className="gl-panel-title">Measure</h2>}
        <button className="gl-panel-collapse" onClick={() => setCollapsed((c) => !c)}>
          <MI
            name={collapsed ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"}
            className="gl-muted-icon"
          />
        </button>
      </div>

      <div className="gl-panel-body">
        {/* ── Tool selection ── */}
        <div className="gl-measure-section">
          <h3 className="gl-group-label">Select Tool</h3>
          <div className="gl-measure-tools">
            {MEASURE_TOOLS.map((tool) => (
              <button
                key={tool.id}
                className={`gl-measure-tool-btn${activeTool === tool.id ? " gl-measure-tool-btn-active" : ""}`}
                onClick={() => onActivate(activeTool === tool.id ? null : tool.id)}
                title={tool.label}
              >
                <MI name={tool.icon} className="gl-measure-tool-icon" />
                <span className="gl-measure-tool-label">{tool.label}</span>
                {activeTool === tool.id && (
                  <MI name="check_circle" className="gl-measure-tool-check" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Active hint ── */}
        {activeTool && (
          <div className="gl-measure-hint">
            <MI name="info" />
            <span>{MEASURE_HINTS[activeTool]}</span>
          </div>
        )}

        <div className="gl-measure-divider" />

        {/* ── Results ── */}
        <div className="gl-measure-section">
          <div className="gl-measure-results-header">
            <h3 className="gl-group-label">Results</h3>
            {results.length > 0 && (
              <button className="gl-measure-clear-btn" onClick={onClear} title="Clear all drawings">
                <MI name="delete_sweep" />
                Clear
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <p className="gl-measure-empty">Draw a shape to see measurements.</p>
          ) : (
            <div className="gl-measure-results">
              {results.map((r, i) => (
                <div key={i} className="gl-measure-result-row">
                  <div className={`gl-measure-result-icon-wrap ${r.type === "distance" ? "gl-measure-icon-dist" : "gl-measure-icon-area"}`}>
                    <MI name={r.type === "distance" ? "timeline" : "square_foot"} />
                  </div>
                  <div className="gl-measure-result-text">
                    <span className="gl-measure-result-label">{r.label}</span>
                    <span className="gl-measure-result-value">{r.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BOOKMARK PANEL
═══════════════════════════════════════════════════════════════ */
const BM_KEY = "geolens_bookmarks";
const loadBookmarks = () => { try { return JSON.parse(localStorage.getItem(BM_KEY) || "[]"); } catch { return []; } };
const saveBookmarks = (bms) => localStorage.setItem(BM_KEY, JSON.stringify(bms));

function BookmarkPanel({ bookmarks, onAdd, onDelete, onFlyTo }) {
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding]       = useState(false);
  const [name, setName]           = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName("");
    setAdding(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter")  handleAdd();
    if (e.key === "Escape") { setAdding(false); setName(""); }
  };

  return (
    <div className={`gl-layer-panel${collapsed ? " gl-layer-panel--collapsed" : ""}`}>
      {/* Header */}
      <div className="gl-panel-header">
        {!collapsed && <h2 className="gl-panel-title">Bookmarks</h2>}
        <button className="gl-panel-collapse" onClick={() => setCollapsed((c) => !c)}>
          <MI name={collapsed ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"} className="gl-muted-icon" />
        </button>
      </div>

      <div className="gl-panel-body">
        {/* Add bookmark section */}
        <div className="gl-bm-add-wrap">
          {!adding ? (
            <button className="gl-bm-add-btn" onClick={() => setAdding(true)}>
              <MI name="add_location_alt" className="gl-bm-add-icon" />
              <span>Bookmark Current View</span>
            </button>
          ) : (
            <div className="gl-bm-input-row">
              <input
                autoFocus
                type="text"
                className="gl-bm-input"
                placeholder="Enter bookmark name…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button className="gl-bm-confirm-btn" onClick={handleAdd} title="Save">
                <MI name="check" />
              </button>
              <button className="gl-bm-cancel-btn" onClick={() => { setAdding(false); setName(""); }} title="Cancel">
                <MI name="close" />
              </button>
            </div>
          )}
        </div>

        <div className="gl-measure-divider" />

        {/* Bookmark list */}
        <div className="gl-bm-list">
          {bookmarks.length === 0 ? (
            <div className="gl-bm-empty">
              <MI name="bookmark_border" className="gl-bm-empty-icon" />
              <p>No bookmarks yet.</p>
              <p>Save the current map view to revisit it later.</p>
            </div>
          ) : (
            bookmarks.map((bm) => (
              <div key={bm.id} className="gl-bm-row" onClick={() => onFlyTo(bm)} title="Fly to this view">
                <div className="gl-bm-icon-wrap">
                  <MI name="bookmark" />
                </div>
                <div className="gl-bm-info">
                  <span className="gl-bm-name">{bm.name}</span>
                  <span className="gl-bm-meta">Zoom {bm.zoom?.toFixed(1)} · {bm.latLon}</span>
                </div>
                <button
                  className="gl-bm-del-btn"
                  onClick={(e) => { e.stopPropagation(); onDelete(bm.id); }}
                  title="Delete bookmark"
                >
                  <MI name="delete" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SPATIAL SELECTION PANEL
═══════════════════════════════════════════════════════════════ */
function SpatialSelectionPanel({ spatialRef, resultCount }) {
  const [activeTool, setActiveTool] = useState(null);

  const handleActivate = (id) => {
    setActiveTool(id);
    spatialRef.current?.activate(id);
  };

  const handleClear = () => {
    setActiveTool(null);
    spatialRef.current?.clear();
  };

  // Reset active tool state when draw completes (MapCanvas calls this)
  useEffect(() => {
    if (!spatialRef) return;
    const prev = spatialRef.current ?? {};
    spatialRef.current = { ...prev, onDrawComplete: () => setActiveTool(null) };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="gl-spatial-panel">
      <div className="gl-panel-header">
        <h2 className="gl-panel-title">Spatial Selection</h2>
      </div>

      <div className="gl-panel-body gl-spatial-body">
        <p className="gl-spatial-hint">
          Draw a shape on the map — all visible WFS features within the area are selected and shown below.
        </p>

        {/* ── Tool Buttons ── */}
        <div className="gl-spatial-tools">
          {SPATIAL_TOOLS.map((tool) => (
            <button
              key={tool.id}
              className={`gl-spatial-tool-btn${activeTool === tool.id ? " gl-spatial-tool-btn--active" : ""}`}
              onClick={() => handleActivate(tool.id)}
              title={tool.label}
            >
              <MI name={tool.icon} style={{ fontSize: 24 }} />
              <span className="gl-spatial-tool-label">{tool.label}</span>
            </button>
          ))}
        </div>

        {/* ── Drawing status ── */}
        {activeTool && (
          <div className="gl-spatial-drawing">
            <MI name="stylus" style={{ fontSize: 15 }} />
            <span>
              Drawing {SPATIAL_TOOLS.find((t) => t.id === activeTool)?.label}…
              {activeTool === "polygon" || activeTool === "freehand"
                ? " double-click to finish"
                : ""}
            </span>
          </div>
        )}

        {/* ── Result badge ── */}
        {resultCount !== null && !activeTool && (
          <div className={`gl-spatial-results${resultCount === 0 ? " gl-spatial-results--empty" : ""}`}>
            <MI name={resultCount > 0 ? "check_circle" : "search_off"} style={{ fontSize: 16 }} />
            <span>
              {resultCount === 0
                ? "No features in drawn area"
                : `${resultCount} feature${resultCount !== 1 ? "s" : ""} selected`}
            </span>
          </div>
        )}

        {/* ── Clear button ── */}
        <button
          className="gl-spatial-clear-btn"
          onClick={handleClear}
          disabled={!activeTool && resultCount === null}
        >
          <MI name="clear_all" style={{ fontSize: 16 }} />
          Clear Selection
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FILTER PANEL
═══════════════════════════════════════════════════════════════ */
const FILTER_OPERATORS = [
  { value: "=",    label: "="        },
  { value: "<>",   label: "≠"        },
  { value: ">",    label: ">"        },
  { value: "<",    label: "<"        },
  { value: ">=",   label: "≥"        },
  { value: "<=",   label: "≤"        },
  { value: "LIKE", label: "contains" },
];

function FilterPanel({ geoLayers, filterRef, onFeaturesSelected }) {
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [propertyNames, setPropertyNames]     = useState([]);
  const [filters, setFilters]                 = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [resultCount, setResultCount]         = useState(null);

  const wfsLayers    = geoLayers.filter((l) => l.group === "wfs");
  const selectedLayer = wfsLayers.find((l) => l.id === selectedLayerId);

  // Fetch a sample feature to discover property names when layer changes
  useEffect(() => {
    if (!selectedLayerId || !selectedLayer?.typeName) {
      setPropertyNames([]);
      setFilters([]);
      setResultCount(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const url =
      `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature` +
      `&typeName=${encodeURIComponent(selectedLayer.typeName)}&outputFormat=application/json&maxFeatures=1`;
    fetch(url, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const props = data?.features?.[0]?.properties
          ? Object.keys(data.features[0].properties).filter(
              (k) => k.toLowerCase() !== "geometry"
            )
          : [];
        setPropertyNames(props);
        setFilters(
          props.length > 0
            ? [{ id: 1, property: props[0], operator: "=", value: "" }]
            : []
        );
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedLayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addFilter = () => {
    if (!propertyNames.length) return;
    setFilters((prev) => [
      ...prev,
      { id: Date.now(), property: propertyNames[0], operator: "=", value: "" },
    ]);
  };
  const removeFilter  = (id) => setFilters((prev) => prev.filter((f) => f.id !== id));
  const updateFilter  = (id, key, val) =>
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: val } : f)));

  const handleApply = async () => {
    if (!selectedLayer?.typeName) return;
    setLoading(true);
    setResultCount(null);
    try {
      const active = filters.filter((f) => f.property && f.value !== "");
      let cql = "";
      if (active.length > 0) {
        cql = active
          .map((f) => {
            const isNum = f.value !== "" && !isNaN(Number(f.value));
            const val   = isNum ? f.value : `'${f.value}'`;
            if (f.operator === "LIKE") return `${f.property} LIKE '%${f.value}%'`;
            return `${f.property}${f.operator}${val}`;
          })
          .join(" AND ");
      }

      let url =
        `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature` +
        `&typeName=${encodeURIComponent(selectedLayer.typeName)}` +
        `&outputFormat=application/json&srsname=EPSG:4326`;
      if (cql) url += `&CQL_FILTER=${encodeURIComponent(cql)}`;

      const res  = await fetch(url, { headers: getAuthHeaders() });
      const data = await res.json();

      const features = (data?.features || []).map((f) => ({
        layerName:  selectedLayer.name,
        properties: { ...(f.properties || {}) },
        geometry:   f.geometry,
      }));

      setResultCount(features.length);
      filterRef.current?.highlight(features);
      onFeaturesSelected(features);
    } catch (e) {
      console.error("Filter apply error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setResultCount(null);
    filterRef.current?.clearHighlight();
    onFeaturesSelected([]);
    if (propertyNames.length > 0)
      setFilters([{ id: Date.now(), property: propertyNames[0], operator: "=", value: "" }]);
  };

  return (
    <div className="gl-filter-panel">
      <div className="gl-panel-header">
        <h2 className="gl-panel-title">Filter Features</h2>
      </div>

      <div className="gl-panel-body gl-filter-body">
        {/* ── Layer Selection ── */}
        <div className="gl-filter-section">
          <label className="gl-filter-label">
            <MI name="layers" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
            Layer
          </label>
          <select
            className="gl-filter-select"
            value={selectedLayerId}
            onChange={(e) => { setSelectedLayerId(e.target.value); setResultCount(null); }}
          >
            <option value="">— Select a WFS layer —</option>
            {wfsLayers.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          {wfsLayers.length === 0 && (
            <p className="gl-filter-hint">
              No WFS layers loaded yet. Enable layers via the Layers panel first.
            </p>
          )}
        </div>

        {/* ── Filter Conditions ── */}
        {selectedLayerId && !loading && propertyNames.length > 0 && (
          <div className="gl-filter-section">
            <div className="gl-filter-section-hdr">
              <label className="gl-filter-label">
                <MI name="tune" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                Conditions
              </label>
              <button className="gl-filter-add-btn" onClick={addFilter}>
                <MI name="add" style={{ fontSize: 14 }} /> Add
              </button>
            </div>
            <div className="gl-filter-rows">
              {filters.map((f, idx) => (
                <div key={f.id} className="gl-filter-row">
                  <span className="gl-filter-logic">{idx === 0 ? "WHERE" : "AND"}</span>
                  <select
                    className="gl-filter-prop-sel"
                    value={f.property}
                    onChange={(e) => updateFilter(f.id, "property", e.target.value)}
                  >
                    {propertyNames.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <select
                    className="gl-filter-op-sel"
                    value={f.operator}
                    onChange={(e) => updateFilter(f.id, "operator", e.target.value)}
                  >
                    {FILTER_OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <input
                    className="gl-filter-val-inp"
                    value={f.value}
                    onChange={(e) => updateFilter(f.id, "value", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleApply()}
                    placeholder="value…"
                  />
                  {filters.length > 1 && (
                    <button className="gl-filter-rm-btn" onClick={() => removeFilter(f.id)}>
                      <MI name="close" style={{ fontSize: 14 }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div className="gl-filter-actions">
          <button
            className="gl-filter-apply-btn"
            onClick={handleApply}
            disabled={!selectedLayerId || loading}
          >
            <MI name="filter_alt" style={{ fontSize: 16 }} />
            Apply Filter
          </button>
          <button
            className="gl-filter-clear-btn"
            onClick={handleClear}
            disabled={!selectedLayerId}
          >
            <MI name="clear_all" style={{ fontSize: 16 }} />
            Clear
          </button>
        </div>

        {/* ── Loading Spinner ── */}
        {loading && (
          <div className="gl-filter-loading">
            <MI name="sync" style={{ fontSize: 18 }} />
            <span>Loading…</span>
          </div>
        )}

        {/* ── Result Count ── */}
        {resultCount !== null && !loading && (
          <div className={`gl-filter-results${resultCount === 0 ? " gl-filter-results--empty" : ""}`}>
            <MI name={resultCount > 0 ? "check_circle" : "search_off"} style={{ fontSize: 16 }} />
            <span>
              {resultCount === 0
                ? "No features matched"
                : `${resultCount} feature${resultCount !== 1 ? "s" : ""} found`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WFS EDIT TOOLBAR (floating, shown while editing a WFS layer)
═══════════════════════════════════════════════════════════════ */
function WfsEditToolbar({
  editLayerName, hasUnsaved, isSaving, insertActive, selectedFeature,
  onAdd, onDelete, onSave, onExit,
}) {
  return (
    <div className="gl-wfs-toolbar">
      {/* Layer badge */}
      <div className="gl-wfs-badge">
        <MI name="edit" style={{ fontSize: 14 }} />
        <span>{editLayerName || "WFS Layer"}</span>
      </div>

      <div className="gl-wfs-sep" />

      {/* Add */}
      <button
        className={`gl-wfs-btn${insertActive ? " gl-wfs-btn--active" : ""}`}
        onClick={onAdd}
        disabled={isSaving}
        title="Add new feature"
      >
        <MI name="add_location_alt" style={{ fontSize: 18 }} />
        <span>Add</span>
      </button>

      {/* Delete */}
      <button
        className="gl-wfs-btn gl-wfs-btn--danger"
        onClick={onDelete}
        disabled={!selectedFeature || isSaving}
        title="Delete selected feature"
      >
        <MI name="delete" style={{ fontSize: 18 }} />
        <span>Delete</span>
      </button>

      {/* Save */}
      <button
        className={`gl-wfs-btn gl-wfs-btn--save${hasUnsaved ? " gl-wfs-btn--unsaved" : ""}`}
        onClick={onSave}
        disabled={!hasUnsaved || isSaving}
        title="Save changes to GeoServer"
      >
        <MI
          name={isSaving ? "sync" : "save"}
          style={{ fontSize: 18, ...(isSaving ? { animation: "gl-spin 1s linear infinite" } : {}) }}
        />
        <span>{isSaving ? "Saving…" : "Save"}</span>
      </button>

      <div className="gl-wfs-sep" />

      {/* Exit edit mode */}
      <button className="gl-wfs-btn gl-wfs-btn--exit" onClick={onExit} title="Exit edit mode">
        <MI name="close" style={{ fontSize: 18 }} />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FLOATING TOOLBAR
═══════════════════════════════════════════════════════════════ */
function FloatingToolbar({ activeTool, setActiveTool }) {
  return (
    <div className="gl-floating-toolbar">
      {TOOLS.map((tool, idx) => (
        <span key={tool.id}>
          {/* Divider after index 0 and index 3 */}
          {TOOL_DIVIDERS.includes(idx - 1) && (
            <div className="gl-toolbar-divider" />
          )}
          <button
            title={tool.title}
            onClick={() => setActiveTool(tool.id)}
            className={`gl-tool-btn
              ${activeTool === tool.id && !tool.danger ? "gl-tool-btn-active" : ""}
              ${tool.danger ? "gl-tool-btn-danger" : ""}
            `}
          >
            <MI name={tool.icon} />
          </button>
        </span>
      ))}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   BASEMAP / ZOOM WIDGET (bottom-right)
═══════════════════════════════════════════════════════════════ */
const BASEMAPS = [

  
  // { id: "world-topo",  name: "World Topo", thumb: "linear-gradient(135deg,#c8d5b3 0%,#8b9e72 40%,#6b8f52 100%)" },
  // { id: "imagery",     name: "Imagery",    thumb: "linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)" },
  // { id: "streets",     name: "Streets",    thumb: "linear-gradient(135deg,#e8e4d9 0%,#d4c9b0 50%,#c9bb9a 100%)" },
  // { id: "ocean",       name: "Ocean",      thumb: "linear-gradient(135deg,#0077b6 0%,#0096c7 50%,#48cae4 100%)" },
  // { id: "dark-gray",   name: "Dark Gray",  thumb: "linear-gradient(135deg,#2d2d2d 0%,#3a3a3a 50%,#4a4a4a 100%)" },
  // { id: "light-gray",  name: "Light Gray", thumb: "linear-gradient(135deg,#f5f5f5 0%,#e8e8e8 50%,#d8d8d8 100%)" },
  { id: "osm",  name: "Open Street Map", thumb: "linear-gradient(135deg,#c8d5b3 0%,#8b9e72 40%,#6b8f52 100%)" },
  { id: "satellite",  name: "Satellite", thumb: "linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)" },
  { id: "toner",  name: "Toner", thumb: "linear-gradient(135deg,#f5f5f5 0%,#e8e8e8 50%,#d8d8d8 100%)" },
];

function BasemapWidget({ layersRef, mapRef, mapMode, setMapMode }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("osm");

  const current = BASEMAPS.find((b) => b.id === selected);

  const zoom = (delta) => {
    const view = mapRef?.current?.getView();
    if (!view) return;
    view.animate({ zoom: view.getZoom() + delta, duration: 250 });
  };

  const select = (id) => {
    setSelected(id);
    setOpen(false);
    const layers = layersRef?.current;
    if (layers) {
      const BASE_KEYS = ["osm", "satellite", "toner"];
      BASE_KEYS.forEach((key) => {
        layers[key]?.setVisible(key === id);
      });
    }
  };

  return (
    <div className="gl-basemap-wrap">
      {/* Compass */}
      <div className="gl-compass">
        <span className="gl-compass-n">N</span>
        <div className="gl-compass-needle" />
      </div>

      {/* Mode Toggle */}
      <div className="gl-mode-toggle-box">
        <button
          className={`gl-mode-btn${mapMode === "select" ? " gl-mode-btn-active" : ""}`}
          title="Selection Mode – interact with features"
          onClick={() => setMapMode("select")}
        >
          <MI name="near_me" />
        </button>
        <button
          className={`gl-mode-btn${mapMode === "map" ? " gl-mode-btn-active" : ""}`}
          title="Map Mode – pan and zoom only"
          onClick={() => setMapMode("map")}
        >
          <MI name="pan_tool" />
        </button>
      </div>

      {/* Zoom +/- */}
      <div className="gl-zoom-box">
        <button className="gl-zoom-btn gl-zoom-top" onClick={() => zoom(1)}>
          <MI name="add" />
        </button>
        <button className="gl-zoom-btn" onClick={() => zoom(-1)}>
          <MI name="remove" />
        </button>
      </div>

      {/* Basemap gallery popup */}
      {open && (
        <div className="gl-basemap-gallery">
          <p className="gl-gallery-title">Basemap Gallery</p>
          <div className="gl-gallery-grid">
            {BASEMAPS.map((bm) => (
              <button
                key={bm.id}
                className={`gl-gallery-item${selected === bm.id ? " gl-gallery-item-active" : ""}`}
                onClick={() => select(bm.id)}
              >
                <div className="gl-gallery-thumb" style={{ background: bm.thumb }} />
                <span className="gl-gallery-name">{bm.name}</span>
                {selected === bm.id && (
                  <MI name="check_circle" className="gl-gallery-check" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Basemap selector button */}
      <button className="gl-basemap-btn" onClick={() => setOpen((o) => !o)}>
        <div className="gl-basemap-thumb" style={{ background: current.thumb }} />
        <div>
          <p className="gl-basemap-sub">Basemap</p>
          <p className="gl-basemap-name">{current.name}</p>
        </div>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OBJECT INVENTORY TABLE
═══════════════════════════════════════════════════════════════ */
function ObjectInventory({ collapsed, setCollapsed, features = [] }) {
  if (features.length === 0) return null;

  // Collect all unique property keys across selected features (skip geometry)
  const allKeys = [
    ...new Set(
      features.flatMap((f) =>
        Object.keys(f.properties || {}).filter((k) => k.toLowerCase() !== "geometry")
      )
    ),
  ];

  return (
    <div className="gl-inventory-wrap">
      <div className={`gl-inventory ${collapsed ? "gl-inventory-collapsed" : ""}`}>
        {/* Table Header */}
        <div className="gl-inventory-header" onClick={() => setCollapsed((c) => !c)}>
          <div className="gl-inventory-header-left">
            <MI name="analytics" className="gl-inv-icon" />
            <h3 className="gl-inv-title">Object Inventory</h3>
            <span className="gl-inv-badge">{features.length} SELECTED</span>
          </div>
          <button className="gl-inv-collapse-btn">
            <MI name={collapsed ? "keyboard_arrow_up" : "keyboard_arrow_down"} />
          </button>
        </div>

        {/* Table Body */}
        {!collapsed && (
          <div className="gl-table-wrap">
            <table className="gl-table">
              <thead>
                <tr className="gl-table-head-row">
                  <th className="gl-th">Layer</th>
                  {allKeys.map((k) => (
                    <th key={k} className="gl-th">{k}</th>
                  ))}
                  <th className="gl-th gl-th-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr
                    key={i}
                    className={`gl-table-row ${i % 2 === 1 ? "gl-table-row-alt" : ""}`}
                  >
                    <td className="gl-td gl-td-id">{f.layerName}</td>
                    {allKeys.map((k) => (
                      <td key={k} className="gl-td">
                        {f.properties[k] != null ? String(f.properties[k]) : "—"}
                      </td>
                    ))}
                    <td className="gl-td gl-td-right">
                      <button className="gl-action-btn">
                        <MI name="more_horiz" style={{ fontSize: 18 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STATUS BAR (footer)
═══════════════════════════════════════════════════════════════ */
function calcScaleBar(resolution, targetPx = 80) {
  if (!resolution) return null;
  const distM = resolution * targetPx;
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 500000, 1000000];
  const useKm = distM >= 1000;
  const value = useKm ? distM / 1000 : distM;
  const nice = steps.find((s) => s >= value) ?? steps[steps.length - 1];
  const niceM = useKm ? nice * 1000 : nice;
  const px = Math.round(niceM / resolution);
  const label = useKm ? `${nice} km` : `${nice} m`;
  return { px, label };
}

function StatusBar({ activeTool, mapScale, coords }) {
  const toolName = TOOLS.find((t) => t.id === activeTool)?.title || "Select";
  const bar = calcScaleBar(mapScale.resolution);
  return (
    <footer className="gl-status-bar">
      <div className="gl-status-left">
        <span className="gl-status-tool">
          <span className="gl-status-dot" />
          {toolName === "Select" ? "Select Features" : toolName}
        </span>
        <span className="gl-status-item gl-status-item-hover">
          Zoom: {mapScale.zoom ?? "—"}
        </span>
        {bar && (
          <span className="gl-status-item gl-scalebar-wrap">
            <span className="gl-scalebar" style={{ width: bar.px }}>
              <span className="gl-scalebar-label">{bar.label}</span>
            </span>
          </span>
        )}
      </div>
      <div className="gl-status-right">
        <span className="gl-status-active-tool">
          Active Tool: {toolName.toUpperCase()}
        </span>
        <div className="gl-status-sep" />
        <span className="gl-status-coords">{coords}</span>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAP CANVAS AREA
═══════════════════════════════════════════════════════════════ */
function MapCanvas({
  activeTool,
  setActiveTool,
  tableCollapsed,
  setTableCollapsed,
  onScaleChange,
  onCoordsChange,
  onLayersLoaded,
  toggleLayerRef,
  mapMode,
  setMapMode,
  measureRef,
  onMeasureResultRef,
  bookmarkRef,
  onFeaturesSelected,
  selectedFeatures,
  filterRef,
  spatialRef,
  onSpatialResult,
  wfsEditRef,
  onEditLayerChange,
}) {
  const mapContainerRef = useRef(null);
  const { mapRef, layersRef, terraDrawRef, doubleClickZoomRef, dragPanRef } = useMapInit(mapContainerRef);
  const wfsLayerMetaRef = useRef({});
  const { availableLayers } = useLayerLoader(mapRef, layersRef, wfsLayerMetaRef);

  // WFS editing
  const {
    editLayerId, hasUnsavedChanges, selectedWfsFeature,
    insertActive, isSaving,
    activateWfsEdit, deactivateWfsEdit,
    saveWfsChanges, activateInsert, deleteSelectedFeature,
  } = useWfsEdit(mapRef, layersRef, wfsLayerMetaRef);

  // Expose activate/deactivate to parent via ref (set each render — same pattern as toggleLayerRef)
  if (wfsEditRef) {
    wfsEditRef.current = {
      activate:   activateWfsEdit,
      deactivate: deactivateWfsEdit,
    };
  }

  // Notify parent when the active edit layer changes
  useEffect(() => {
    onEditLayerChange?.(editLayerId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editLayerId]);

  const editLayerName = availableLayers.find((l) => l.id === editLayerId)?.name ?? editLayerId;

  const drawContextRef    = useRef(null); // "measure" | "spatial" | null
  const onSpatialResultRef = useRef(onSpatialResult);
  useEffect(() => { onSpatialResultRef.current = onSpatialResult; }, [onSpatialResult]);

  // Fill the toggle ref so parent can call it
  toggleLayerRef.current = (id, visible, bbox4326) => {
    layersRef.current[id]?.setVisible(visible);
    if (visible && bbox4326 && mapRef.current) {
      const extent = transformExtent(bbox4326, "EPSG:4326", "EPSG:3857");
      mapRef.current.getView().fit(extent, { duration: 500, padding: [40, 40, 40, 40] });
    }
  };

  useEffect(() => {
    if (availableLayers.length > 0) onLayersLoaded(availableLayers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      const view = map.getView();
      const resolution = view.getResolution();
      const zoom = view.getZoom();
      const scale = Math.round(resolution * 3779.527559);
      onScaleChange({ zoom: zoom?.toFixed(1), scale, resolution });
    };

    const onPointerMove = (evt) => {
      const [lon, lat] = toLonLat(evt.coordinate);
      const latStr = `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? "N" : "S"}`;
      const lonStr = `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? "E" : "W"}`;
      onCoordsChange(`${latStr},  ${lonStr}`);
    };

    map.on("moveend", update);
    map.on("pointermove", onPointerMove);
    update();
    return () => {
      map.un("moveend", update);
      map.un("pointermove", onPointerMove);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fill bookmarkRef with map view operations
  useEffect(() => {
    if (!bookmarkRef) return;
    bookmarkRef.current = {
      getViewState: () => ({
        center: mapRef.current?.getView().getCenter(),
        zoom:   mapRef.current?.getView().getZoom(),
      }),
      flyTo: ({ center, zoom }) => {
        mapRef.current?.getView().animate({ center, zoom, duration: 700 });
      },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref to mapMode and onFeaturesSelected so the click handler never goes stale
  const mapModeRef = useRef(mapMode);
  useEffect(() => { mapModeRef.current = mapMode; }, [mapMode]);
  const onFeaturesSelectedRef = useRef(onFeaturesSelected);
  useEffect(() => { onFeaturesSelectedRef.current = onFeaturesSelected; }, [onFeaturesSelected]);

  // Feature selection on single-click when mode === "select"
  useEffect(() => {
    let rafId;
    const init = () => {
      const map = mapRef.current;
      if (!map) { rafId = requestAnimationFrame(init); return; }

      const handleClick = async (evt) => {
        if (mapModeRef.current !== "select") return;

        const features = [];

        // 1. Query WFS vector features at pixel
        map.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
          const props = { ...feature.getProperties() };
          delete props.geometry;
          const name =
            layer?.get("title") || layer?.get("name") ||
            layer?.getSource?.()?.getParams?.()?.LAYERS || "WFS Layer";
          features.push({ layerName: name, properties: props });
        });

        // 2. Fall back to WMS GetFeatureInfo for visible tile layers
        if (features.length === 0) {
          const viewResolution = map.getView().getResolution();
          for (const layer of map.getLayers().getArray()) {
            if (!layer.getVisible?.()) continue;
            const source = layer.getSource?.();
            if (!source?.getFeatureInfoUrl) continue;
            const url = source.getFeatureInfoUrl(
              evt.coordinate,
              viewResolution,
              "EPSG:3857",
              { INFO_FORMAT: "application/json", FEATURE_COUNT: 10 }
            );
            if (!url) continue;
            try {
              const res = await fetch(url, { headers: getAuthHeaders() });
              const data = await res.json();
              if (data?.features?.length > 0) {
                const layerName =
                  source.getParams?.()?.LAYERS ||
                  data.id?.split(".")[0] ||
                  "WMS Layer";
                data.features.forEach((f) => {
                  features.push({ layerName, properties: f.properties || {} });
                });
              }
            } catch {}
          }
        }

        onFeaturesSelectedRef.current?.(features);
      };

      map.on("singleclick", handleClick);
      return () => map.un("singleclick", handleClick);
    };
    rafId = requestAnimationFrame(init);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Highlight layer for filter results
  useEffect(() => {
    let rafId;
    let removeLayer;
    const init = () => {
      const map = mapRef.current;
      if (!map) { rafId = requestAnimationFrame(init); return; }

      const source = new VectorSource();
      const layer  = new VectorLayer({
        source,
        style: new Style({
          fill:   new Fill({ color: "rgba(255, 220, 0, 0.35)" }),
          stroke: new Stroke({ color: "#FFD600", width: 3 }),
          image:  new CircleStyle({
            radius: 8,
            fill:   new Fill({ color: "#FFD600" }),
            stroke: new Stroke({ color: "#fff", width: 2 }),
          }),
        }),
        zIndex: 200,
      });
      layer.set("isHighlight", true);
      map.addLayer(layer);
      removeLayer = () => map.removeLayer(layer);

      if (filterRef) {
        const fmt = new GeoJSON();
        filterRef.current = {
          highlight: (features) => {
            source.clear();
            const olFeats = features.flatMap((f) => {
              if (!f.geometry) return [];
              try {
                return [fmt.readFeature(
                  { type: "Feature", geometry: f.geometry, properties: f.properties },
                  { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }
                )];
              } catch { return []; }
            });
            source.addFeatures(olFeats);
            if (olFeats.length > 0) {
              const ext = source.getExtent();
              if (ext && ext.every(isFinite))
                map.getView().fit(ext, { duration: 600, padding: [60, 40, 220, 40] });
            }
          },
          clearHighlight: () => source.clear(),
        };
      }
    };
    rafId = requestAnimationFrame(init);
    return () => { cancelAnimationFrame(rafId); removeLayer?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // TerraDraw: measure + spatial selection finish handler
  useEffect(() => {
    let rafId;
    let cleanupSpatialLayer;
    const init = () => {
      const draw = terraDrawRef.current;
      const map  = mapRef.current;
      if (!draw || !map) { rafId = requestAnimationFrame(init); return; }

      const enableInteractions = () => {
        doubleClickZoomRef.current?.setActive(true);
        dragPanRef.current?.setActive(true);
      };

      // Spatial selection highlight layer (cyan)
      const spatialSource = new VectorSource();
      const spatialLayer  = new VectorLayer({
        source: spatialSource,
        style: new Style({
          fill:   new Fill({ color: "rgba(0, 200, 255, 0.25)" }),
          stroke: new Stroke({ color: "#00C8FF", width: 2.5 }),
          image:  new CircleStyle({
            radius: 8,
            fill:   new Fill({ color: "#00C8FF" }),
            stroke: new Stroke({ color: "#fff", width: 2 }),
          }),
        }),
        zIndex: 201,
      });
      spatialLayer.set("isHighlight", true);
      map.addLayer(spatialLayer);
      cleanupSpatialLayer = () => map.removeLayer(spatialLayer);

      draw.on("finish", (id) => {
        enableInteractions();
        const snapshot = draw.getSnapshot();
        const feature  = snapshot.find((f) => String(f.id) === String(id));
        if (!feature) return;
        const modeId = feature.properties?.mode;
        const ctx    = drawContextRef.current;
        drawContextRef.current = null;

        if (ctx === "spatial") {
          // Convert drawn geometry to EPSG:3857 for spatial query
          let drawnGeom;
          try {
            drawnGeom = _geoFmt.readGeometry(feature.geometry, {
              dataProjection: "EPSG:4326", featureProjection: "EPSG:3857",
            });
          } catch { try { draw.setMode("static"); } catch {} return; }

          const drawnExtent = drawnGeom.getExtent();
          const selected    = [];
          spatialSource.clear();

          map.getLayers().forEach((layer) => {
            if (!layer.getVisible?.()) return;
            if (layer.get("isHighlight")) return; // skip highlight layers
            const source = layer.getSource?.();
            if (!source?.forEachFeatureIntersectingExtent) return;
            const layerName = layer.get("title") || layer.get("name") || "WFS Layer";
            source.forEachFeatureIntersectingExtent(drawnExtent, (feat) => {
              const allProps = feat.getProperties();
              if (allProps.mode !== undefined) return; // skip TerraDraw own features
              const props = { ...allProps };
              delete props.geometry;
              selected.push({ layerName, properties: props });
              spatialSource.addFeature(feat.clone());
            });
          });

          onFeaturesSelectedRef.current?.(selected);
          onSpatialResultRef.current?.(selected.length);
          spatialRef?.current?.onDrawComplete?.();
          try { draw.setMode("static"); } catch {}

        } else {
          // Measure context (or untagged fallback)
          const tool = MEASURE_TOOLS.find((t) => t.id === modeId);
          if (!tool) { try { draw.setMode("static"); } catch {} return; }
          const value = calcMeasurement(feature);
          if (value) onMeasureResultRef?.current?.({ label: tool.label, value, type: tool.type });
          try { draw.setMode("static"); } catch {}
        }
      });

      // measureRef API
      if (measureRef) {
        measureRef.current = {
          activate: (mode) => {
            if (!mode) {
              enableInteractions();
              drawContextRef.current = null;
              try { draw.setMode("static"); } catch {}
            } else {
              drawContextRef.current = "measure";
              doubleClickZoomRef.current?.setActive(false);
              dragPanRef.current?.setActive(false);
              try { draw.setMode(mode); } catch {}
            }
          },
          clear: () => {
            draw.clear();
            drawContextRef.current = null;
            enableInteractions();
            try { draw.setMode("static"); } catch {}
          },
        };
      }

      // spatialRef API
      if (spatialRef) {
        const prev = spatialRef.current ?? {};
        spatialRef.current = {
          ...prev,
          activate: (mode) => {
            draw.clear();
            spatialSource.clear();
            drawContextRef.current = "spatial";
            doubleClickZoomRef.current?.setActive(false);
            dragPanRef.current?.setActive(false);
            try { draw.setMode(mode); } catch {}
          },
          clear: () => {
            draw.clear();
            spatialSource.clear();
            drawContextRef.current = null;
            enableInteractions();
            try { draw.setMode("static"); } catch {}
            onFeaturesSelectedRef.current?.([]);
            onSpatialResultRef.current?.(null);
          },
        };
      }
    };
    rafId = requestAnimationFrame(init);
    return () => { cancelAnimationFrame(rafId); cleanupSpatialLayer?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={mapContainerRef} className={`map-container${mapMode === "select" ? " map-container--select" : ""}`}>
      <FloatingToolbar activeTool={activeTool} setActiveTool={setActiveTool} />
      {editLayerId && (
        <WfsEditToolbar
          editLayerName={editLayerName}
          hasUnsaved={hasUnsavedChanges}
          isSaving={isSaving}
          insertActive={insertActive}
          selectedFeature={selectedWfsFeature}
          onAdd={activateInsert}
          onDelete={deleteSelectedFeature}
          onSave={saveWfsChanges}
          onExit={deactivateWfsEdit}
        />
      )}
      <BasemapWidget layersRef={layersRef} mapRef={mapRef} mapMode={mapMode} setMapMode={setMapMode} />
      <ObjectInventory
        collapsed={tableCollapsed}
        setCollapsed={setTableCollapsed}
        features={selectedFeatures}
      />
    </div>

    // </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════ */
export default function GeoLens() {
  const [activeNav, setActiveNav] = useState("layers");
  const [activeTool, setActiveTool] = useState("select");
  const [tableCollapsed, setTableCollapsed] = useState(true);
  const [mapScale, setMapScale] = useState({ zoom: "—", scale: null });
  const [coords, setCoords] = useState("—");
  const [mapMode, setMapMode] = useState("map");

  // Static layer visibility state – keyed by layer id
  const initialLayers = Object.fromEntries(
    [...OPERATIONAL_LAYERS, ...REFERENCE_LAYERS].map((l) => [
      l.id,
      l.defaultChecked,
    ]),
  );
  const [layers, setLayers] = useState(initialLayers);

  // GeoServer layers loaded via useLayerLoader
  const [geoLayers, setGeoLayers] = useState([]);
  const [geoVisibility, setGeoVisibility] = useState({});
  const toggleLayerRef = useRef(null);
  const filterRef      = useRef(null);
  const spatialRef     = useRef(null);
  const wfsEditRef     = useRef(null);

  const [spatialResultCount, setSpatialResultCount] = useState(null);
  const [activeEditLayerId, setActiveEditLayerId]   = useState(null);

  // Bookmark state
  const [bookmarks, setBookmarks]   = useState(loadBookmarks);
  const bookmarkRef                 = useRef(null);

  const handleAddBookmark = useCallback((name) => {
    const { center, zoom } = bookmarkRef.current?.getViewState() ?? {};
    if (!center) return;
    const [lon, lat] = toLonLat(center);
    const latLon = `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? "E" : "W"}`;
    const bm = { id: Date.now(), name, center, zoom, latLon };
    setBookmarks((prev) => { const next = [...prev, bm]; saveBookmarks(next); return next; });
  }, []);

  const handleDeleteBookmark = useCallback((id) => {
    setBookmarks((prev) => { const next = prev.filter((b) => b.id !== id); saveBookmarks(next); return next; });
  }, []);

  const handleFlyToBookmark = useCallback((bm) => {
    bookmarkRef.current?.flyTo(bm);
  }, []);

  // Measure state
  const [measureResults, setMeasureResults] = useState([]);
  const [measureActiveTool, setMeasureActiveTool] = useState(null);
  const measureRef = useRef(null);
  const onMeasureResultRef = useRef(null);
  onMeasureResultRef.current = ({ label, value, type }) => {
    setMeasureResults((prev) => [...prev, { label, value, type }]);
    setMeasureActiveTool(null);
  };

  const handleMeasureActivate = useCallback((id) => {
    setMeasureActiveTool(id);
    measureRef.current?.activate(id);
  }, []);

  const handleMeasureClear = useCallback(() => {
    measureRef.current?.clear();
    setMeasureResults([]);
    setMeasureActiveTool(null);
  }, []);

  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const handleFeaturesSelected = useCallback((features) => {
    setSelectedFeatures(features);
    if (features.length > 0) setTableCollapsed(false);
  }, []);

  const handleLayersLoaded = useCallback((loaded) => {
    setGeoLayers(loaded);
    setGeoVisibility(Object.fromEntries(loaded.map((l) => [l.id, false])));
  }, []);

  const handleToggleGeoLayer = useCallback((id) => {
    setGeoVisibility((prev) => {
      const next = !prev[id];
      const bbox4326 = geoLayers.find((l) => l.id === id)?.bbox4326;
      toggleLayerRef.current?.(id, next, next ? bbox4326 : null);
      return { ...prev, [id]: next };
    });
  }, [geoLayers]);

  return (
    <div className="gl-root">
      <Header />

      <div className="gl-body">
        {/* Left icon rail */}
        <NavRail active={activeNav} setActive={setActiveNav} />

        {/* Main content */}
        <main className="gl-main">
          {/* Layer Manager slide-out */}
          {activeNav === "layers" && (
            <LayerManager
              layers={layers}
              setLayers={setLayers}
              geoLayers={geoLayers}
              geoVisibility={geoVisibility}
              onToggleGeoLayer={handleToggleGeoLayer}
              wfsEditRef={wfsEditRef}
              activeEditLayerId={activeEditLayerId}
            />
          )}
          {activeNav === "legend" && (
            <LegendPanel geoLayers={geoLayers} geoVisibility={geoVisibility} />
          )}
          {activeNav === "measure" && (
            <MeasurePanel
              results={measureResults}
              activeTool={measureActiveTool}
              onActivate={handleMeasureActivate}
              onClear={handleMeasureClear}
            />
          )}
          {activeNav === "bookmark" && (
            <BookmarkPanel
              bookmarks={bookmarks}
              onAdd={handleAddBookmark}
              onDelete={handleDeleteBookmark}
              onFlyTo={handleFlyToBookmark}
            />
          )}
          {activeNav === "spatial" && (
            <SpatialSelectionPanel
              spatialRef={spatialRef}
              resultCount={spatialResultCount}
            />
          )}
          {activeNav === "filter" && (
            <FilterPanel
              geoLayers={geoLayers}
              filterRef={filterRef}
              onFeaturesSelected={handleFeaturesSelected}
            />
          )}
          {/* Interactive Map */}
          <MapCanvas
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            tableCollapsed={tableCollapsed}
            setTableCollapsed={setTableCollapsed}
            onScaleChange={setMapScale}
            onCoordsChange={setCoords}
            onLayersLoaded={handleLayersLoaded}
            toggleLayerRef={toggleLayerRef}
            mapMode={mapMode}
            setMapMode={setMapMode}
            measureRef={measureRef}
            onMeasureResultRef={onMeasureResultRef}
            bookmarkRef={bookmarkRef}
            onFeaturesSelected={handleFeaturesSelected}
            selectedFeatures={selectedFeatures}
            filterRef={filterRef}
            spatialRef={spatialRef}
            onSpatialResult={setSpatialResultCount}
            wfsEditRef={wfsEditRef}
            onEditLayerChange={setActiveEditLayerId}
          />
        </main>
      </div>

      <StatusBar activeTool={activeTool} mapScale={mapScale} coords={coords} />
    </div>
  );
}
