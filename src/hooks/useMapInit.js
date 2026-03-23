import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat, getUserProjection } from 'ol/proj';
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom';
import DoubleClickZoom from 'ol/interaction/DoubleClickZoom';
import DragPan from 'ol/interaction/DragPan';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import Icon from 'ol/style/Icon';
import CircleStyle from 'ol/style/Circle';
import Projection from 'ol/proj/Projection';
import { Point } from 'ol/geom';
import { Feature } from 'ol';
import markerSvg from '../assets/img/marker.svg';
import ContextMenu from 'ol-contextmenu';
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawRectangleMode,
  TerraDrawFreehandMode,
  TerraDrawPolygonMode,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
} from 'terra-draw';
import { TerraDrawOpenLayersAdapter } from 'terra-draw-openlayers-adapter';

export function useMapInit(mapContainerRef, setSelectMode) {
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const markerSourceRef = useRef(new VectorSource());
  const markerLayerRef = useRef(null);
  const terraDrawRef = useRef(null);
  const doubleClickZoomRef = useRef(null);
  const dragPanRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;

    const osmLayer = new TileLayer({ source: new OSM(), visible: true });

    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles &copy; Esri',
      }),
      visible: false,
    });

    const tonerLayer = new TileLayer({
      source: new XYZ({
        url: 'http://mt{0-3}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        attributions: '© Google ',
      }),
      visible: false,
    });

    layersRef.current = { osm: osmLayer, satellite: satelliteLayer, toner: tonerLayer };

    const markerLayer = new VectorLayer({ source: markerSourceRef.current });
    markerLayerRef.current = markerLayer;

    const contextmenu = new ContextMenu({
      width: 170,
      defaultItems: true,
      items: [
        {
          text: 'Center map here',
          callback: (obj, map) => { map.getView().setCenter(obj.coordinate); },
        },
        {
          text: 'Add a Marker',
          callback: (obj) => {
            const marker = new Feature({ geometry: new Point(obj.coordinate) });
            marker.setStyle(new Style({
              image: new Icon({ src: markerSvg, scale: 0.05, anchor: [0.5, 1] }),
            }));
            markerSourceRef.current.addFeature(marker);
          },
        },
        '-',
      ],
    });

    mapRef.current = new Map({
      target: mapContainerRef.current,
      layers: [osmLayer, satelliteLayer, tonerLayer, markerLayer],
      view: new View({ center: fromLonLat([0, 0]), zoom: 2 }),
      // controls: [contextmenu],
      interactions: [dragPanRef.current = new DragPan(), new MouseWheelZoom(), doubleClickZoomRef.current = new DoubleClickZoom()],
    });

    mapRef.current.once('rendercomplete', () => {
      const draw = new TerraDraw({
        adapter: new TerraDrawOpenLayersAdapter({
          lib: {
            Feature,
            GeoJSON,
            Style,
            VectorLayer,
            VectorSource,
            Stroke,
            Fill,
            Circle: CircleStyle,
            Icon,
            Projection,
            getUserProjection,
            fromLonLat,
            toLonLat,
          },
          map: mapRef.current,
        }),
        modes: [
          new TerraDrawRectangleMode(),
          new TerraDrawCircleMode(),
          new TerraDrawFreehandMode(),
          new TerraDrawPolygonMode(),
          new TerraDrawLineStringMode(),
          new TerraDrawPointMode(),
        ],
      });

      draw.start();
      draw.on('finish', () => {
        setSelectMode?.('none');
        if (doubleClickZoomRef.current) doubleClickZoomRef.current.setActive(true);
      });
      terraDrawRef.current = draw;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { mapRef, layersRef, markerSourceRef, markerLayerRef, terraDrawRef, doubleClickZoomRef, dragPanRef };
}
