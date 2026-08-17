"use client";

// "use client": the map centre comes from SettingsProvider, and the grey
// placeholder is cleared by the iframe's own load event.

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useSettings } from "@/providers/SettingsProvider";

import { buildMapLinks, DEFAULT_MAP_LOCATION_LABEL } from "./contactDetails";

export function ContactMap() {
  const { settings } = useSettings();
  const [mapLoaded, setMapLoaded] = useState(false);
  const { ref: mapRef, isVisible: mapVisible } = useScrollReveal({ threshold: 0.15 });

  const mapLocationLabel = settings.mapLocationLabel || DEFAULT_MAP_LOCATION_LABEL;
  const { embedUrl, directionsUrl } = buildMapLinks(
    Number(settings.mapLatitude),
    Number(settings.mapLongitude),
    mapLocationLabel,
  );

  return (
    <div
      className={`mt-10 sm:mt-12 lg:mt-14 reveal reveal-left ${
        mapVisible ? "active" : ""
      }`}
      ref={mapRef}
    >
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
        <div className="px-5 py-4 md:px-6 md:py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-base md:text-lg font-bold text-[#2d3a2d]">
              Visit Our Store
            </h3>
            <p className="text-sm text-[#6b7a6b]">{mapLocationLabel}</p>
          </div>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3d7a3d] hover:text-[#2f642f]"
          >
            Open in Google Maps
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        <div className="relative h-[260px] sm:h-[320px] md:h-[360px]">
          {!mapLoaded && (
            <div
              className="absolute inset-0 bg-[#f3f4f2]"
              aria-hidden="true"
            />
          )}
          <iframe
            src={embedUrl}
            width="100%"
            height="100%"
            onLoad={() => setMapLoaded(true)}
            style={{ border: 0 }}
            allowFullScreen
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
            title="Naturanza Location"
          />
        </div>
      </div>
    </div>
  );
}
