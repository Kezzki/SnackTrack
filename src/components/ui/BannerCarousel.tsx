import { useEffect, useCallback, useState } from "react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const bannerSlides = [
    {
        image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=400&fit=crop&q=80",
        title: "Jajanan Terlengkap",
        subtitle: "Temukan berbagai pilihan snack favorit kamu",
    },
    {
        image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&h=400&fit=crop&q=80",
        title: "Harga Terjangkau",
        subtitle: "Belanja hemat setiap hari",
    },
    {
        image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1200&h=400&fit=crop&q=80",
        title: "Pengiriman Cepat",
        subtitle: "Pesanan sampai dalam hitungan menit",
    },
    {
        image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=1200&h=400&fit=crop&q=80",
        title: "Promo Spesial",
        subtitle: "Diskon menarik untuk pelanggan baru",
    },
];

interface BannerCarouselProps {
    className?: string;
}

export function BannerCarousel({ className }: BannerCarouselProps) {
    const [api, setApi] = useState<CarouselApi>();
    const [current, setCurrent] = useState(0);
    const [count, setCount] = useState(0);

    const onSelect = useCallback(() => {
        if (!api) return;
        setCurrent(api.selectedScrollSnap());
        setCount(api.scrollSnapList().length);
    }, [api]);

    useEffect(() => {
        if (!api) return;
        onSelect();
        api.on("select", onSelect);
        return () => { api.off("select", onSelect); };
    }, [api, onSelect]);

    // Autoplay
    useEffect(() => {
        if (!api) return;
        const interval = setInterval(() => {
            if (api.canScrollNext()) {
                api.scrollNext();
            } else {
                api.scrollTo(0);
            }
        }, 4000);
        return () => clearInterval(interval);
    }, [api]);

    return (
        <div className={cn("w-full", className)}>
            <Carousel
                setApi={setApi}
                opts={{ loop: true, align: "start" }}
                className="w-full"
            >
                <CarouselContent>
                    {bannerSlides.map((slide, index) => (
                        <CarouselItem key={index}>
                            <div className="relative w-full h-24 sm:h-28 md:h-36 rounded-2xl overflow-hidden">
                                <img
                                    src={slide.image}
                                    alt={slide.title}
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                                {/* Gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                                {/* Text */}
                                <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10">
                                    <h3 className="text-white text-lg sm:text-2xl font-bold drop-shadow-lg">
                                        {slide.title}
                                    </h3>
                                    <p className="text-white/80 text-xs sm:text-sm mt-1 drop-shadow-md max-w-xs">
                                        {slide.subtitle}
                                    </p>
                                </div>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>

            {/* Dot indicators */}
            {count > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                    {Array.from({ length: count }).map((_, i) => (
                        <button
                            key={i}
                            onClick={() => api?.scrollTo(i)}
                            className={cn(
                                "h-1.5 rounded-full transition-all duration-300",
                                current === i
                                    ? "w-6 bg-primary"
                                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
