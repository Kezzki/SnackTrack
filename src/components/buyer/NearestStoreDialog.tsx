import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Navigation, Store, ArrowLeft, Star, Share2, ChevronRight, Clock, Route, X } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface RouteStep {
    instruction: string;
    distance: number;
    duration: number;
    maneuverType: string;
    maneuverModifier?: string;
}

interface RouteSummary {
    distance: number; // metres
    duration: number; // seconds
}

function formatDuration(seconds: number): string {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} mnt`;
    return `${Math.floor(mins / 60)} jam ${mins % 60} mnt`;
}

function formatStepDist(metres: number): string {
    if (metres < 1000) return `${Math.round(metres)} m`;
    return `${(metres / 1000).toFixed(1)} km`;
}

function ManeuverIcon({ type, modifier }: { type: string; modifier?: string }) {
    const arrow = (() => {
        if (type === "arrive") return "🏁";
        if (type === "depart") return "🚦";
        if (!modifier) return "⬆️";
        if (modifier === "left") return "⬅️";
        if (modifier === "right") return "➡️";
        if (modifier === "sharp left") return "↰";
        if (modifier === "sharp right") return "↱";
        if (modifier === "slight left") return "↖️";
        if (modifier === "slight right") return "↗️";
        if (modifier === "uturn") return "↩️";
        return "⬆️";
    })();
    return <span className="text-base leading-none">{arrow}</span>;
}

interface NearestStoreDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function NearestStoreDialog({ open, onOpenChange }: NearestStoreDialogProps) {
    const navigate = useNavigate();
    const [stores, setStores] = useState<any[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
    const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
    const [routeLoading, setRouteLoading] = useState(false);
    const [showDirections, setShowDirections] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
    const markerElsRef = useRef<Record<string, HTMLDivElement>>({});
    const storeRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const routeLayerRef = useRef<string | null>(null);
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
    // Keeps the latest user coords without causing re-renders (used in route fetch + watchPosition)
    const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
    // Track whether we've already loaded data so reopening doesn't reset
    const initializedRef = useRef(false);

    useEffect(() => {
        if (open) {
            // Only fetch data on first open
            if (!initializedRef.current) {
                initializedRef.current = true;
                setLoading(true);
                setLocationError(null);

                const fetchStores = async () => {
                    const { data, error } = await supabase.from("stores").select("*").limit(100);
                    if (data && !error) {
                        setStores(data.filter((s) => s.latitude && s.longitude && s.latitude !== 0 && s.longitude !== 0));
                    }
                };
                fetchStores();

                if (!navigator.geolocation) {
                    setLocationError("Browser Anda tidak mendukung geolokasi");
                    setLoading(false);
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        setUserLocation(loc);
                        userLocationRef.current = loc;
                        setLoading(false);
                    },
                    () => {
                        const loc = { lat: -6.2088, lng: 106.8456 };
                        setLocationError("Izin lokasi ditolak. Menggunakan lokasi default (Jakarta).");
                        setUserLocation(loc);
                        userLocationRef.current = loc;
                        setLoading(false);
                    }
                );
            }
        } else {
            // On close: destroy map so it can reinit when the DOM remounts on next open
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                markersRef.current = {};
                routeLayerRef.current = null;
                userMarkerRef.current = null;
            }
            // Allow re-init next open (map DOM node gets remounted)
            initializedRef.current = false;
            setMapReady(false);
            setSelectedStoreId(null);
            setShowDirections(false);
            setRouteSteps([]);
            setRouteSummary(null);
            markerElsRef.current = {};
        }
    }, [open]);

    const initMap = useCallback(() => {
        if (!mapRef.current || mapInstanceRef.current || !userLocation) return;

        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        mapboxgl.accessToken = token;

        const map = new mapboxgl.Map({
            container: mapRef.current,
            style: "mapbox://styles/mapbox/streets-v12",
            center: [userLocation.lng, userLocation.lat],
            zoom: 13,
        });

        map.addControl(new mapboxgl.NavigationControl(), "top-right");

        // User location marker (green pulsing dot) — stored in ref for live position updates
        const userEl = document.createElement("div");
        userEl.style.cssText = "width:16px;height:16px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);";
        userMarkerRef.current = new mapboxgl.Marker({ element: userEl })
            .setLngLat([userLocation.lng, userLocation.lat])
            .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML("📍 Lokasi Anda"))
            .addTo(map);

        // Store markers
        stores.forEach((store) => {
            const popup = new mapboxgl.Popup({ offset: 20 }).setHTML(
                `<strong>${store.name}</strong><br/><span style="font-size:12px;color:#666">${store.address || ""}</span>`
            );

            const el = document.createElement("div");
            el.style.cssText = "cursor:pointer;transition:transform 0.15s;transform-origin:bottom center;";
            el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
  <path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 22 14 22S28 23.33 28 14C28 6.27 21.73 0 14 0z" fill="#3b82f6" stroke="white" stroke-width="2"/>
  <circle cx="14" cy="14" r="5" fill="white"/>
</svg>`;
            markerElsRef.current[store.id] = el;

            const marker = new mapboxgl.Marker({ element: el })
                .setLngLat([store.longitude, store.latitude])
                .setPopup(popup)
                .addTo(map);

            el.addEventListener("click", () => {
                setSelectedStoreId(store.id);
                storeRefs.current[store.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });

            markersRef.current[store.id] = marker;
        });

        // Fit bounds to include all markers
        if (stores.length > 0) {
            const bounds = new mapboxgl.LngLatBounds();
            bounds.extend([userLocation.lng, userLocation.lat]);
            stores.forEach((s) => bounds.extend([s.longitude, s.latitude]));
            map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
        }

        mapInstanceRef.current = map;
        // Signal that the map + style are fully ready (triggers route effect)
        map.once("load", () => setMapReady(true));
    }, [userLocation, stores]);

    useEffect(() => {
        if (!loading && userLocation && open) {
            // Small delay to ensure DOM is ready
            const timer = setTimeout(initMap, 100);
            return () => clearTimeout(timer);
        }
    }, [loading, userLocation, open, initMap]);

    // Live position tracking — updates user marker without re-fetching routes
    useEffect(() => {
        if (!mapReady || !navigator.geolocation) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                userLocationRef.current = { lat, lng };
                userMarkerRef.current?.setLngLat([lng, lat]);
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 5000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [mapReady]);

    // Highlight selected store marker — red + enlarged, others back to blue
    useEffect(() => {
        Object.entries(markerElsRef.current).forEach(([id, el]) => {
            const path = el.querySelector("path");
            if (id === selectedStoreId) {
                el.style.transform = "scale(1.4)";
                el.style.zIndex = "10";
                if (path) path.setAttribute("fill", "#ef4444");
            } else {
                el.style.transform = "scale(1)";
                el.style.zIndex = "0";
                if (path) path.setAttribute("fill", "#3b82f6");
            }
        });
    }, [selectedStoreId]);

    const handleStoreClick = (storeId: string) => {
        setSelectedStoreId(storeId);
        setShowDirections(false);
        const store = stores.find((s) => s.id === storeId);
        const map = mapInstanceRef.current;
        if (store && map) {
            map.flyTo({ center: [store.longitude, store.latitude], zoom: 15, speed: 1.4 });
            // Open popup after fly animation finishes (~600ms)
            setTimeout(() => {
                const marker = markersRef.current[storeId];
                if (marker && !marker.getPopup().isOpen()) marker.togglePopup();
            }, 650);
        }
    };

    const storesWithDistance = useMemo(
        () => userLocation
            ? stores
                .map((s) => ({ ...s, distance: getDistance(userLocation.lat, userLocation.lng, s.latitude, s.longitude) }))
                .sort((a, b) => a.distance - b.distance)
            : [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [stores, userLocation?.lat, userLocation?.lng]
    );

    const activeStore = useMemo(
        () => selectedStoreId ? storesWithDistance.find((s) => s.id === selectedStoreId) ?? null : null,
        [selectedStoreId, storesWithDistance]
    );

    useEffect(() => {
        // Wait for map style to be ready (mapReady guarantees style is loaded)
        if (!mapReady) return;
        const map = mapInstanceRef.current;
        const loc = userLocationRef.current;
        if (!map || !loc) return;

        const ROUTE_SOURCE = "route";
        const ROUTE_LAYER = "route-line";

        const removeRoute = () => {
            if (map.getLayer(ROUTE_LAYER)) map.removeLayer(ROUTE_LAYER);
            if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);
            routeLayerRef.current = null;
        };

        if (activeStore) {
            setRouteLoading(true);
            const token = import.meta.env.VITE_MAPBOX_TOKEN;
            fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${loc.lng},${loc.lat};${activeStore.longitude},${activeStore.latitude}?steps=true&language=id&geometries=geojson&overview=full&access_token=${token}`
            )
                .then((res) => res.json())
                .then((data) => {
                    const route = data.routes?.[0];
                    if (!route) return;

                    // Parse steps from the first leg
                    const steps: RouteStep[] = (route.legs?.[0]?.steps ?? []).map((s: any) => ({
                        instruction: s.maneuver?.instruction ?? s.name ?? "",
                        distance: s.distance,
                        duration: s.duration,
                        maneuverType: s.maneuver?.type ?? "",
                        maneuverModifier: s.maneuver?.modifier,
                    }));
                    setRouteSteps(steps);
                    setRouteSummary({ distance: route.distance, duration: route.duration });

                    const geojson = route.geometry;
                    // mapReady guarantees style is loaded — add route directly
                    removeRoute();
                    map.addSource(ROUTE_SOURCE, { type: "geojson", data: { type: "Feature", properties: {}, geometry: geojson } });
                    map.addLayer({
                        id: ROUTE_LAYER,
                        type: "line",
                        source: ROUTE_SOURCE,
                        layout: { "line-join": "round", "line-cap": "round" },
                        paint: { "line-color": "#3b82f6", "line-width": 5, "line-opacity": 0.85 },
                    });
                    routeLayerRef.current = ROUTE_LAYER;

                    const coords: [number, number][] = geojson.coordinates;
                    const bounds = coords.reduce(
                        (b, c) => b.extend(c),
                        new mapboxgl.LngLatBounds(coords[0], coords[0])
                    );
                    map.fitBounds(bounds, { padding: 60 });
                    // Re-open store popup once fitBounds animation settles
                    setTimeout(() => {
                        const marker = markersRef.current[activeStore.id];
                        if (marker && !marker.getPopup().isOpen()) marker.togglePopup();
                    }, 700);
                })
                .catch((err) => console.error("Error fetching route:", err))
                .finally(() => setRouteLoading(false));
        } else {
            setRouteSteps([]);
            setRouteSummary(null);
            removeRoute();
            const bounds = new mapboxgl.LngLatBounds();
            bounds.extend([loc.lng, loc.lat]);
            stores.forEach((s) => bounds.extend([s.longitude, s.latitude]));
            if (stores.length > 0) map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
        }
    }, [activeStore, mapReady, stores]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPortal>
                <DialogOverlay />
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                <DialogPrimitive.Content
                    className="pointer-events-auto relative flex flex-col p-0 overflow-hidden bg-background shadow-lg w-full h-[100dvh] rounded-none md:w-full md:max-w-4xl md:h-auto md:max-h-[85vh] md:rounded-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200"
                    onFocusOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                {/* Header — compact on mobile, spacious on desktop */}
                <DialogHeader className="px-4 py-2.5 md:px-6 md:pt-6 md:pb-3 flex-shrink-0 border-b md:border-none">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <MapPin className="h-4 w-4 md:h-5 md:w-5 text-primary" /> Toko Terdekat
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Navigation className="h-8 w-8 text-primary animate-pulse" />
                        <p className="text-muted-foreground mt-3">Mencari lokasi Anda...</p>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row-reverse flex-1 min-h-0">
                        {/* Map Panel — fixed 40% height on mobile, flex-1 on desktop */}
                        <div className="h-[38vh] md:h-auto md:flex-1 relative shrink-0">
                            <div ref={mapRef} className="w-full h-full" />
                        </div>

                        {/* Store Sidebar — scrollable panel below map on mobile */}
                        <div className="flex-1 md:flex-none md:w-80 border-t md:border-t-0 md:border-r border-border overflow-hidden bg-background flex flex-col relative min-h-0">
                            {activeStore ? (
                                <div className="flex flex-col h-full min-w-0 animate-in slide-in-from-bottom-4 md:slide-in-from-left-4 fade-in duration-200">
                                    <div className="sticky top-0 z-10 px-3 py-2 bg-background/95 backdrop-blur-sm border-b flex items-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => { setSelectedStoreId(null); setShowDirections(false); }} className="h-8 gap-1.5 hover:bg-muted">
                                            <ArrowLeft className="h-4 w-4" /> Kembali
                                        </Button>
                                        <div className="ml-auto flex items-center gap-1">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="h-8 gap-1.5 text-xs rounded-full"
                                                onClick={() => { onOpenChange(false); navigate(`/toko/profil/${activeStore.id}`); }}
                                            >
                                                <Store className="h-3.5 w-3.5" /> Kunjungi Toko
                                            </Button>
                                        </div>
                                    </div>

                                    {showDirections || !routeSummary ? (
                                        /* ── Directions Panel ── */
                                        <div className="flex flex-col flex-1 min-h-0">
                                            {routeSummary && (
                                                <div className="flex items-center gap-4 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-b text-sm">
                                                    <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400">
                                                        <Navigation className="h-4 w-4" />
                                                        {formatStepDist(routeSummary.distance)}
                                                    </div>
                                                    <div className="w-px h-4 bg-border" />
                                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {formatDuration(routeSummary.duration)}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
                                                {routeLoading ? (
                                                    <div className="flex justify-center py-8 text-muted-foreground text-sm">Memuat petunjuk arah...</div>
                                                ) : routeSteps.length === 0 ? (
                                                    <div className="flex justify-center py-8 text-muted-foreground text-sm">Tidak ada petunjuk arah</div>
                                                ) : (
                                                    <ol className="divide-y">
                                                        {routeSteps.map((step, i) => (
                                                            <li key={i} className="flex items-start gap-3 px-4 py-3">
                                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0 mt-0.5 text-sm">
                                                                    <ManeuverIcon type={step.maneuverType} modifier={step.maneuverModifier} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm leading-snug">{step.instruction}</p>
                                                                    {step.distance > 0 && (
                                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                                            {formatStepDist(step.distance)} · {formatDuration(step.duration)}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ol>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── Store Info Panel ── */
                                        <div className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
                                            {(activeStore.banner_url || activeStore.image_url) ? (
                                                <img src={activeStore.banner_url || activeStore.image_url} alt={activeStore.name} className="w-full h-24 md:h-40 object-cover" />
                                            ) : null}
                                            <div className="p-3 md:p-4 space-y-3">
                                                <div>
                                                    <h3 className="text-lg md:text-xl font-bold">{activeStore.name}</h3>
                                                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                        <Store className="w-3.5 h-3.5" /> Toko Roti
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-3 border-y py-2.5">
                                                    {activeStore.rating > 0 && (
                                                        <>
                                                            <div className="flex items-center font-medium bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
                                                                <span>{Number(activeStore.rating).toFixed(1)}</span>
                                                                <Star className="w-3.5 h-3.5 ml-1 fill-primary text-primary" />
                                                            </div>
                                                            <div className="w-px h-6 bg-border" />
                                                        </>
                                                    )}
                                                    <div className="text-sm">
                                                        <span className="font-semibold text-primary">
                                                            {activeStore.distance < 1 ? `${(activeStore.distance * 1000).toFixed(0)} m` : `${activeStore.distance.toFixed(1)} km`}
                                                        </span>
                                                        <span className="text-muted-foreground ml-1">dari sini</span>
                                                    </div>
                                                    {routeSummary && (
                                                        <>
                                                            <div className="w-px h-6 bg-border" />
                                                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                                <Clock className="h-3 w-3" /> {formatDuration(routeSummary.duration)}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap gap-2 pt-2">
                                                    <Button
                                                        className="flex-1 h-9 rounded-full gap-2 font-medium"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setShowDirections(true);
                                                            const map = mapInstanceRef.current;
                                                            if (activeStore && map) {
                                                                map.flyTo({ center: [activeStore.longitude, activeStore.latitude], zoom: 15, speed: 1.4 });
                                                                setTimeout(() => {
                                                                    const marker = markersRef.current[activeStore.id];
                                                                    if (marker && !marker.getPopup().isOpen()) marker.togglePopup();
                                                                }, 650);
                                                            }
                                                        }}
                                                    >
                                                        <Route className="h-4 w-4" /> Petunjuk Arah
                                                    </Button>
                                                    <Button variant="outline" className="flex-1 h-9 rounded-full gap-2 font-medium"
                                                        onClick={() => navigator.share?.({ title: activeStore.name, text: activeStore.address, url: `https://www.google.com/maps?q=${activeStore.latitude},${activeStore.longitude}` }).catch(() => {})}
                                                    >
                                                        <Share2 className="h-4 w-4" /> Bagikan
                                                    </Button>
                                                </div>

                                                <div className="flex items-start gap-3 text-sm">
                                                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                                    <span className="leading-relaxed text-muted-foreground">{activeStore.address}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-200">
                                    {locationError && (
                                        <p className="text-sm text-warning bg-warning/10 p-3 m-3 rounded-lg flex-shrink-0">{locationError}</p>
                                    )}
                                    {userLocation && (
                                        <p className="text-xs text-muted-foreground px-4 pt-2 flex-shrink-0">
                                            📍 {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                                        </p>
                                    )}
                                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
                                        {storesWithDistance.map((store, i) => (
                                            <div
                                                key={store.id}
                                                ref={(el) => { storeRefs.current[store.id] = el; }}
                                                onClick={() => handleStoreClick(store.id)}
                                                className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card hover:shadow-warm hover:border-primary/30 cursor-pointer transition-all"
                                            >
                                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                                                    <Store className="h-4 w-4 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-sm truncate">{store.name}</h4>
                                                        {i === 0 && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full whitespace-nowrap">Terdekat</span>}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{store.address}</p>
                                                    <div className="flex items-center justify-between mt-1.5">
                                                        <p className="text-sm font-medium text-primary">
                                                            {store.distance < 1 ? `${(store.distance * 1000).toFixed(0)} meter` : `${store.distance.toFixed(1)} km`}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                </DialogPrimitive.Content>
                </div>
            </DialogPortal>
        </Dialog>
    );
}
