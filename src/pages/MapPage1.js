import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fromLonLat, transformExtent } from 'ol/proj';
// import Sidebar from '../components/Sidebar';
import SearchBar from '../components/SearchBar';
import FeaturePopup from '../components/FeaturePopup';
import { useMapInit } from '../hooks/useMapInit';
import { useLayerLoader } from '../hooks/useLayerLoader';
import { useFeaturePopup } from '../hooks/useFeaturePopup';
import { useDrawTools } from '../hooks/useDrawTools';
import { useWfsEdit } from '../hooks/useWfsEdit';
import '../styles/MapPage.css';
const ChevronRight = ({ size = 14, color = "#aaa" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
);
const ChevronLeft = ({ size = 14, color = "#aaa" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
);

const MENU = [
  { icon: "\u{1F5A5}", label: "My Gadgets" },
  { icon: "\u{1F3E8}", label: "Book Hotels" },
  { icon: "\u{1F697}", label: "Book Zoomcar" },
  { icon: "\u{1F6D2}", label: "ONDC Shopping" },
  { icon: "\u{1F4CD}", label: "Add a Place" },
  { icon: "\u{1F3E2}", label: "Add a Business" },
  { icon: "\u{1F4EE}", label: "Know Your DIGIPIN", badge: "New" },
  { icon: "\u2728", label: "Know Your Mappls Pin" },
  { icon: "\u{1F310}", label: "Set Language (English)" },
  { icon: "\u{1F4E4}", label: "Share My Location" },
  { icon: "\u{1F3AF}", label: "Take a Tour" },
  { icon: "\u{1F4AC}", label: "Send Feedback" },
  { icon: "\u{1F465}", label: "Refer a Friend" },
  { icon: "\u{1F4DE}", label: "Contact Us" },
  { icon: "\u2753", label: "Help" },
];

const APPS = ["Mappls", "Navi Maps", "DriveMate", "Intouch", "SafeMate", "Workmate"];

const CARDS = [
  { title: "Mappls India", desc: "Learn about India's own Map Platforms & Services", bg: "linear-gradient(140deg,#e3eefa,#cddff5)", color: "#1565c0", emoji: "\u{1F5FA}\uFE0F" },
  { title: "\u0915\u0940\u0930\u094D\u0924\u093F \u0915\u093E \u0938\u0902\u0917\u092E", desc: "A confluence of culture & values", bg: "linear-gradient(140deg,#fff3e0,#ffe0b2)", color: "#e65100", emoji: "\u{1F3DB}\uFE0F" },
  { title: "Mappls Map", desc: "Search for anything with Conditions and Preferences", bg: "linear-gradient(140deg,#e0f2e9,#c8e6c9)", color: "#2e7d32", emoji: "\u{1F50D}" },
  { title: "Mappls Pin", desc: "A unique 6-digit digital address", bg: "linear-gradient(140deg,#fce4ec,#f8bbd0)", color: "#c62828", emoji: "\u{1F4CC}" },
  { title: "Report Errors", desc: "Help us fix map errors in your region", bg: "linear-gradient(140deg,#f3e5f5,#e1bee7)", color: "#7b1fa2", emoji: "\u{1F41B}" },
];

const CITIES = [
  { x: 34, y: 12, name: "Delhi", s: 5, c: "#c62828" },
  { x: 24, y: 19, name: "Jaipur", s: 3.5 },
  { x: 46, y: 15, name: "Lucknow", s: 3.5 },
  { x: 62, y: 17, name: "Patna", s: 3 },
  { x: 80, y: 25, name: "Kolkata", s: 4, c: "#1565c0" },
  { x: 16, y: 30, name: "Ahmedabad", s: 3.5 },
  { x: 43, y: 32, name: "Bhopal", s: 3 },
  { x: 12, y: 45, name: "Mumbai", s: 5, c: "#c62828" },
  { x: 32, y: 48, name: "Pune", s: 3 },
  { x: 50, y: 40, name: "Nagpur", s: 3 },
  { x: 64, y: 37, name: "Raipur", s: 2.5 },
  { x: 54, y: 56, name: "Hyderabad", s: 4, c: "#6a1b9a" },
  { x: 72, y: 48, name: "Visakhapatnam", s: 2.5 },
  { x: 8, y: 62, name: "Goa", s: 2.5 },
  { x: 40, y: 70, name: "Bengaluru", s: 4, c: "#2e7d32" },
  { x: 60, y: 72, name: "Chennai", s: 3.5, c: "#e65100" },
  { x: 24, y: 72, name: "Mangalore", s: 2.5 },
  { x: 50, y: 84, name: "Madurai", s: 2.5 },
  { x: 42, y: 92, name: "Trivandrum", s: 2.5 },
  { x: 18, y: 10, name: "Chandigarh", s: 2.5 },
];

const ROADS = [
  [34,12,24,19],[34,12,46,15],[46,15,62,17],[62,17,80,25],
  [24,19,16,30],[16,30,12,45],[12,45,32,48],[32,48,50,40],
  [50,40,43,32],[43,32,34,12],[50,40,64,37],[64,37,72,48],
  [72,48,54,56],[54,56,60,72],[54,56,40,70],[40,70,24,72],
  [40,70,60,72],[60,72,50,84],[50,84,42,92],[12,45,8,62],
  [8,62,24,72],[32,48,54,56],[50,40,46,15],[34,12,18,10],
];

function Sidebar({ open }) {
  const [hov, setHov] = useState(-1);
  return (
    <div style={{
      width: open ? 250 : 0, minWidth: open ? 250 : 0, height: "100%",
      background: "#fff", borderRight: open ? "1px solid #e0e0e0" : "none",
      overflow: "hidden", transition: "all .3s cubic-bezier(.4,0,.2,1)",
      zIndex: 20, flexShrink: 0,
    }}>
      <div style={{ width: 250, height: "100%", overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" }}>
          <span style={{ fontWeight: 900, fontSize: 21, letterSpacing: 4, color: "#3ba5a5", fontFamily: "'Trebuchet MS',sans-serif" }}>MAPPLS</span>
          <div style={{ display: "flex", gap: 14 }}>
            <span style={{ cursor: "pointer", opacity: 0.55, fontSize: 16 }}>{"\u{1F50D}"}</span>
            <span style={{ cursor: "pointer", opacity: 0.55, fontSize: 16 }}>{"\u{1F3E0}"}</span>
          </div>
        </div>
        <div style={{ padding: "6px 16px 8px", fontSize: 12, color: "#777", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 4 }}>
          Region : India <span style={{ color: "#3ba5a5", cursor: "pointer", fontSize: 10 }}>{"\u270F\uFE0F"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: 12, cursor: "pointer", borderBottom: "1px solid #eee" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#bbb" }}>{"\u{1F464}"}</div>
          <span style={{ fontWeight: 600, fontSize: 15, flex: 1, color: "#333" }}>Login</span>
          <ChevronRight />
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 12, borderBottom: "1px solid #eee", cursor: "pointer" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#3ba5a5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 700 }}>{"\u{1F4E1}"}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#333" }}>My World View</div>
            <div style={{ fontSize: 11, color: "#999" }}>Your Feed</div>
          </div>
        </div>
        <div style={{ padding: "2px 0" }}>
          {MENU.map((item, i) => (
            <div key={i}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(-1)}
              style={{
                display: "flex", alignItems: "center", padding: "9px 16px", gap: 14,
                cursor: "pointer", fontSize: 13.5, color: "#444",
                background: hov === i ? "#f5f5f5" : "transparent",
                transition: "background .12s",
              }}>
              <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span style={{ background: "#e53935", color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 7, letterSpacing: .4 }}>{item.badge}</span>
              )}
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid #eee", padding: "10px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#333", marginBottom: 4 }}>Mappls Mobile Apps</div>
          {APPS.map((app, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "7px 0", gap: 12, fontSize: 13.5, color: "#444", cursor: "pointer" }}>
              <span style={{ fontSize: 12, opacity: .45 }}>{"\u2B50"}</span><span>{app}</span>
            </div>
          ))}
        </div>
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

function PromoPanel({ open }) {
  return (
    <div style={{
      width: open ? 195 : 0, minWidth: open ? 195 : 0, height: "100%",
      background: "#f7f6f2", borderRight: open ? "1px solid #e8e6df" : "none",
      overflow: "hidden", transition: "all .3s cubic-bezier(.4,0,.2,1)",
      zIndex: 15, flexShrink: 0,
    }}>
      <div style={{ width: 195, height: "100%", overflowY: "auto", padding: "10px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
        {CARDS.map((c, i) => (
          <div key={i} style={{
            background: c.bg, borderRadius: 12, padding: "14px 12px",
            cursor: "pointer", minHeight: 110, display: "flex", flexDirection: "column",
            justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,.05)",
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: c.color, marginBottom: 3 }}>{c.title}</div>
              <div style={{ fontSize: 10.5, color: "#555", lineHeight: 1.4 }}>{c.desc}</div>
            </div>
            <div style={{ fontSize: 26, textAlign: "right", marginTop: 6, lineHeight: 1 }}>{c.emoji}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// function MapSVG() {
//   return (
    
//   );
// }

function MapControls() {
  const btns = [
    { label: "Pray", text: "\u{1F64F}", mb: 14 },
    { label: "+", text: "+", mb: 2 },
    { label: "\u2212", text: "\u2212", mb: 2 },
    { label: "Layers", text: "\u25C8", mb: 2 },
    { label: "3D", text: "3D", mb: 2 },
    { label: "Pin", text: "\u{1F4CD}", mb: 2 },
    { label: "Locate", text: "\u2295", mb: 0 },
  ];
  const [hov, setHov] = useState(-1);
  return (
    <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", zIndex: 10 }}>
      {btns.map((b, i) => (
        <div key={i} style={{ marginBottom: b.mb }}>
          <button
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(-1)}
            title={b.label}
            style={{
              width: 34, height: 34, borderRadius: 4, background: hov === i ? "#f0f0f0" : "#fff",
              border: "1px solid #d0d0d0", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 15, color: "#555", fontWeight: b.text === "3D" || b.text === "+" || b.text === "\u2212" ? 700 : 400,
              boxShadow: "0 1px 3px rgba(0,0,0,.08)", transition: "background .12s",
            }}>
            {b.text}
          </button>
        </div>
      ))}
    </div>
  );
}

function TopBar() {
  return (
    <div style={{ position: "absolute", top: 10, right: 14, display: "flex", gap: 8, alignItems: "center", zIndex: 10 }}>
      {["\u{1F30D}", "\u2328\uFE0F"].map((e, i) => (
        <button key={i} style={{
          width: 34, height: 34, borderRadius: "50%", background: "#fff", border: "1px solid #ddd",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14,
          boxShadow: "0 1px 3px rgba(0,0,0,.07)",
        }}>{e}</button>
      ))}
      <button style={{
        width: 34, height: 34, borderRadius: "50%", background: "#fff", border: "1px solid #ddd",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14,
        position: "relative", boxShadow: "0 1px 3px rgba(0,0,0,.07)",
      }}>
        {"\u{1F514}"}
        <span style={{ position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: "50%", background: "#ffc107", border: "1.5px solid #fff" }} />
      </button>
      <button style={{
        height: 34, borderRadius: 17, background: "#fff", border: "1px solid #ddd",
        display: "flex", alignItems: "center", gap: 5, padding: "0 12px", cursor: "pointer",
        fontSize: 12.5, color: "#444", boxShadow: "0 1px 3px rgba(0,0,0,.07)",
      }}>
        {"\u2728"} Get the app <span style={{ fontSize: 9 }}>{"\u25BE"}</span>
      </button>
      {["\u{1F310}", "\u{1F464}"].map((e, i) => (
        <button key={i} style={{
          width: 34, height: 34, borderRadius: "50%", background: "#fff", border: "1px solid #ddd",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14,
          boxShadow: "0 1px 3px rgba(0,0,0,.07)",
        }}>{e}</button>
      ))}
    </div>
  );
}

function DirectionToggle() {
  const [active, setActive] = useState(0);
  return (
    <div style={{
      position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
      display: "flex", borderRadius: 8, overflow: "hidden", zIndex: 10,
      boxShadow: "0 2px 8px rgba(0,0,0,.15)",
    }}>
      {["\u{1F9ED} Directions", "\u{1F464} Nearby"].map((l, i) => (
        <button key={i} onClick={() => setActive(i)} style={{
          padding: "9px 18px", border: "none", cursor: "pointer",
          background: active === i ? "#3ba5a5" : "#4db8b8",
          color: "#fff", fontSize: 12.5, fontWeight: 600,
          transition: "background .2s", opacity: active === i ? 1 : .82,
        }}>{l}</button>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "5px 14px", background: "rgba(255,255,255,.82)",
      borderTop: "1px solid #e8e4dc", zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 900, letterSpacing: 3, color: "#3ba5a5", fontSize: 13, fontFamily: "'Trebuchet MS',sans-serif" }}>MAPPLS</span>
        <span style={{ color: "#ccc", fontSize: 14 }}>|</span>
        <span style={{ fontFamily: "'Brush Script MT',cursive", color: "#c65d3a", fontSize: 15, fontStyle: "italic" }}>MapmyIndia</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#999", fontSize: 10 }}>
        <span style={{ padding: "2px 6px", border: "1px solid #ddd", borderRadius: 3, background: "#fff", fontSize: 9 }}>100 km</span>
        <span>Map Data &copy; MapmyIndia | Govt. (v15.0)</span>
      </div>
    </div>
  );
}

export default function MapplsUI() {
  const mapContainerRef = useRef(null);
  const wfsLayerMetaRef = useRef({});
  const navigate = useNavigate();

  // const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectMode, setSelectMode] = useState('none');

  // ── Hooks ────────────────────────────────────────────────────────────────
  const { mapRef, layersRef, terraDrawRef, doubleClickZoomRef } = useMapInit(mapContainerRef, setSelectMode);
  const { availableLayers, layersLoading } = useLayerLoader(mapRef, layersRef, wfsLayerMetaRef);

  const {
    editLayerId, hasUnsavedChanges, selectedWfsFeature, insertActive, isSaving: editSaving,
    activateWfsEdit, deactivateWfsEdit, saveWfsChanges, activateInsert, deleteSelectedFeature,
  } = useWfsEdit(mapRef, layersRef, wfsLayerMetaRef);

  const {
    popupInfo, setPopupInfo, handleSaveFeatureProps, isSaving: popupSaving,
  } = useFeaturePopup(mapRef, layersRef, wfsLayerMetaRef, editLayerId);

  const {
    activateCircleDraw, activateRectangleDraw, activateFreehandDraw,
    activatePolygonDraw, activateLineDraw, activatePointDraw, clearSelections,
  } = useDrawTools(terraDrawRef, setSelectMode, doubleClickZoomRef);

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem('gsAuth')) navigate('/');
  }, [navigate]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('gsAuth');
    localStorage.removeItem('gsUser');
    navigate('/');
  };

  const handleSearch = (location) => {
    mapRef.current?.getView().animate({
      center: fromLonLat([location.lon, location.lat]),
      zoom: 12,
      duration: 500,
    });
  };

  const handleLayerToggle = (layerId, isVisible) => {
    const layer = layersRef.current[layerId];
    if (!layer) return;
    layer.setVisible(isVisible);

    if (!isVisible || !mapRef.current) return;

    const layerEntry = availableLayers.find((l) => l.id === layerId);
    if (layerEntry?.bbox4326) {
      const bbox = layerEntry.bbox4326;
      if (bbox.every(isFinite)) {
        const extent = transformExtent(bbox, 'EPSG:4326', 'EPSG:3857');
        mapRef.current.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 600, maxZoom: 18 });
      }
    } else {
      const src = layer.getSource?.();
      if (src?.getExtent) {
        const extent = src.getExtent();
        if (extent && extent.every(isFinite)) {
          mapRef.current.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 600, maxZoom: 18 });
        }
      }
    }
  };

  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [promoOpen, setPromoOpen] = useState(true);

  const toggle = () => {
    if (sidebarOpen) { setSidebarOpen(false); setPromoOpen(false); }
    else { setSidebarOpen(true); setPromoOpen(true); }
  };

  const toggleLeft = (sidebarOpen ? 250 : 0) + (promoOpen ? 195 : 0);

  return (
    <div style={{
      width: "100vw", height: "100vh", display: "flex", overflow: "hidden",
      fontFamily: "'Segoe UI','Helvetica Neue',system-ui,sans-serif",
    }}>
      <Sidebar open={sidebarOpen} 
       
      isOpen={sidebarOpen}
        availableLayers={availableLayers}
        onLayerToggle={handleLayerToggle}
        editLayerId={editLayerId}
        onWfsEdit={activateWfsEdit}
        layersLoading={layersLoading}/>
      <PromoPanel open={promoOpen} />
      <button onClick={toggle} style={{
        position: "absolute", left: toggleLeft, top: "50%", transform: "translateY(-50%)",
        width: 18, height: 46, borderRadius: "0 6px 6px 0",
        background: "#fff", border: "1px solid #ddd", borderLeft: "none",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 25, boxShadow: "2px 0 4px rgba(0,0,0,.06)",
        transition: "left .3s cubic-bezier(.4,0,.2,1)",
      }}>
        {sidebarOpen ? <ChevronLeft size={11} color="#999" /> : <ChevronRight size={11} color="#999" />}
      </button>
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#e5e0cc" }}>
        <div ref={mapContainerRef} className="map-container">
          <FeaturePopup
            info={popupInfo}
            onClose={() => setPopupInfo(null)}
            onSave={handleSaveFeatureProps}
            isSaving={popupSaving}
          />
        </div>
        <DirectionToggle />
        <TopBar />
        <MapControls />
        <Footer />
      </div>
    </div>
  );
}