"use client";
// Map of companies (MapLibre + free OpenFreeMap tiles, no API key). Pins are colored by the metric the list is
// showing (Probability of Winning, Joiner Upside or For you); gray = not evaluated yet. Nearby pins cluster; click a cluster to zoom in, a pin to open the scorecard.
import { useEffect, useMemo, useRef } from "react";
import Map, { Source, Layer, NavigationControl } from "react-map-gl/maplibre";
import type { MapRef, MapLayerMouseEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CompanyRow } from "@/lib/supabase-public";
import { scoreColor } from "@/lib/display";

const STYLE = "https://tiles.openfreemap.org/styles/positron";

// Continental US, coast to coast: the map opens fitted to this whatever the window size.
const US_BOUNDS: [[number, number], [number, number]] = [[-124.8, 24.4], [-66.9, 49.4]];

export default function MapView({
  companies,
  selectedId,
  onSelect,
  valueOf,
  metricLabel,
  fitKey,
}: {
  companies: CompanyRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  valueOf: (c: CompanyRow) => number | null;
  metricLabel: string;
  fitKey?: string; // changes when a search/location filter changes: zoom the map to the results
}) {
  const ref = useRef<MapRef>(null);

  useEffect(() => {
    const pts = companies.filter((c) => c.lat != null && c.lng != null);
    const map = ref.current;
    if (!map) return;
    if (!fitKey || pts.length === 0 || pts.length > 150) {
      if (!fitKey) map.fitBounds(US_BOUNDS, { padding: 24, duration: 500 });
      return;
    }
    const lngs = pts.map((c) => c.lng!), lats = pts.map((c) => c.lat!);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 80, maxZoom: 10, duration: 600 });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: companies
        .filter((c) => c.lat != null && c.lng != null)
        .map((c) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [c.lng!, c.lat!] },
          properties: {
            id: c.id,
            name: c.name,
            color: scoreColor(valueOf(c)),
            evaluated: valueOf(c) != null ? 1 : 0,
            selected: c.id === selectedId ? 1 : 0,
          },
        })),
    }),
    [companies, selectedId, valueOf],
  );

  const onClick = async (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    if (f.layer.id === "clusters") {
      const src: any = ref.current?.getSource("companies");
      const zoom = await src?.getClusterExpansionZoom(f.properties?.cluster_id);
      const [lng, lat] = (f.geometry as any).coordinates;
      ref.current?.easeTo({ center: [lng, lat], zoom: zoom ?? 8, duration: 500 });
    } else if (f.properties?.id) {
      onSelect(String(f.properties.id));
    }
  };

  const missing = companies.filter((c) => c.lat == null || c.lng == null).length;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Map
        ref={ref}
        initialViewState={{ bounds: US_BOUNDS, fitBoundsOptions: { padding: 24 } }}
        mapStyle={STYLE}
        interactiveLayerIds={["clusters", "points"]}
        onClick={onClick}
        cursor="pointer"
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-left" showCompass={false} />
        <Source id="companies" type="geojson" data={geojson} cluster clusterMaxZoom={9} clusterRadius={38}>
          <Layer
            id="clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": "#a41034",
              "circle-opacity": 0.85,
              "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 24, 150, 30],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{ "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Bold"] }}
            paint={{ "text-color": "#fff" }}
          />
          <Layer
            id="points"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": ["get", "color"],
              "circle-radius": ["case", ["==", ["get", "selected"], 1], 10, ["==", ["get", "evaluated"], 1], 8, 5],
              "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 3, 1.5],
              "circle-stroke-color": "#fff",
            }}
          />
          <Layer
            id="labels"
            type="symbol"
            filter={["all", ["!", ["has", "point_count"]], ["==", ["get", "evaluated"], 1]]}
            layout={{ "text-field": ["get", "name"], "text-size": 12, "text-offset": [0, 1.3], "text-anchor": "top", "text-font": ["Noto Sans Regular"] }}
            paint={{ "text-color": "#1c1c1a", "text-halo-color": "#fff", "text-halo-width": 1.5 }}
          />
        </Source>
      </Map>
      <div style={{ position: "absolute", left: 12, bottom: 12, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
        <b>{metricLabel}</b>{" "}
        {[["≥75", "#15803d"], ["60–74", "#65a30d"], ["45–59", "#d97706"], ["<45", "#dc2626"], ["not evaluated", "#9ca3af"]].map(([l, c]) => (
          <span key={l} style={{ marginLeft: 8, whiteSpace: "nowrap" }}>
            <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 9, background: c, marginRight: 4 }} />
            {l}
          </span>
        ))}
        {missing > 0 && <span className="muted" style={{ marginLeft: 8 }}>· {missing} without a map location</span>}
      </div>
    </div>
  );
}
