import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { cn } from "@/lib/utils";

interface IndonesiaMapPickerProps {
    latitude?: number;
    longitude?: number;
    onLocationSelect: (lat: number, lng: number, address?: string) => void;
    className?: string;
}

export function IndonesiaMapPicker({ latitude, longitude, onLocationSelect, className }: IndonesiaMapPickerProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
    const markerRef = useRef<mapboxgl.Marker | null>(null);
    const [address, setAddress] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const reverseGeocode = async (lat: number, lng: number) => {
        setLoading(true);
        try {
            const token = import.meta.env.VITE_MAPBOX_TOKEN;
            const res = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?language=id&types=address,place,locality,neighborhood&country=ID&access_token=${token}`
            );
            const data = await res.json();
            const place = data.features?.[0]?.place_name;
            if (place) {
                setAddress(place);
                onLocationSelect(lat, lng, place);
            }
        } catch {
            // Geocoding failed silently
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        mapboxgl.accessToken = token;

        const defaultLng = longitude || 118;
        const defaultLat = latitude || -2.5;
        const defaultZoom = latitude && longitude ? 13 : 4;

        const map = new mapboxgl.Map({
            container: mapRef.current,
            style: "mapbox://styles/mapbox/streets-v12",
            center: [defaultLng, defaultLat],
            zoom: defaultZoom,
            maxBounds: [[94, -11], [142, 7]], // Indonesia bounds [sw, ne]
            minZoom: 3,
        });

        map.addControl(new mapboxgl.NavigationControl(), "top-right");

        // Place initial marker if coords provided
        if (latitude && longitude) {
            markerRef.current = new mapboxgl.Marker({ color: "#ef4444", draggable: true })
                .setLngLat([longitude, latitude])
                .addTo(map);
            reverseGeocode(latitude, longitude);

            markerRef.current.on("dragend", () => {
                const lngLat = markerRef.current!.getLngLat();
                onLocationSelect(lngLat.lat, lngLat.lng);
                reverseGeocode(lngLat.lat, lngLat.lng);
            });
        }

        // Click handler — place/move marker
        map.on("click", (e) => {
            const { lat, lng } = e.lngLat;

            if (markerRef.current) {
                markerRef.current.setLngLat([lng, lat]);
            } else {
                markerRef.current = new mapboxgl.Marker({ color: "#ef4444", draggable: true })
                    .setLngLat([lng, lat])
                    .addTo(map);

                markerRef.current.on("dragend", () => {
                    const lngLat = markerRef.current!.getLngLat();
                    onLocationSelect(lngLat.lat, lngLat.lng);
                    reverseGeocode(lngLat.lat, lngLat.lng);
                });
            }

            onLocationSelect(lat, lng);
            reverseGeocode(lat, lng);
        });

        mapInstanceRef.current = map;

        return () => {
            map.remove();
            mapInstanceRef.current = null;
            markerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={cn("space-y-2", className)}>
            <label className="text-sm font-medium text-foreground">
                Lokasi Toko <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-2">
                Klik pada peta untuk menandai lokasi toko Anda. Anda juga dapat menggeser marker.
            </p>
            <div
                ref={mapRef}
                className="w-full h-[250px] sm:h-[300px] rounded-xl border border-border overflow-hidden z-0"
            />
            {address && (
                <div className="p-3 rounded-lg bg-muted text-sm text-foreground">
                    <span className="font-medium">Alamat: </span>
                    {loading ? "Mencari alamat..." : address}
                </div>
            )}
        </div>
    );
}
