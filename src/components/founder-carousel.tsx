"use client";

import Image, { type StaticImageData } from "next/image";
import { useState } from "react";

export type FounderSlide = { src: StaticImageData; alt: string; caption: string };

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
      <path
        d={direction === "left" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FounderCarousel({ slides }: { slides: FounderSlide[] }) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const move = (step: number) => setIndex((current) => (current + step + slides.length) % slides.length);

  return (
    <figure className="reveal mx-auto w-full max-w-md">
      <div className="relative overflow-hidden rounded-[2rem] bg-paper-2">
        <Image
          key={index}
          src={slide.src}
          alt={slide.alt}
          placeholder="blur"
          sizes="(min-width: 1024px) 28rem, 90vw"
          className="aspect-[4/5] w-full object-cover"
        />

        {slides.length > 1 && (
          <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-4">
            <div className="flex gap-1.5" aria-hidden="true">
              {slides.map((item, i) => (
                <span
                  key={item.alt}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-paper" : "w-1.5 bg-paper/50"}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => move(-1)}
                className="grid size-9 place-items-center rounded-full bg-ink/70 text-paper backdrop-blur transition-colors hover:bg-ink"
              >
                <span className="sr-only">Previous photo</span>
                <Chevron direction="left" />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                className="grid size-9 place-items-center rounded-full bg-ink/70 text-paper backdrop-blur transition-colors hover:bg-ink"
              >
                <span className="sr-only">Next photo</span>
                <Chevron direction="right" />
              </button>
            </div>
          </div>
        )}
      </div>

      <figcaption className="mt-4 text-sm leading-relaxed text-muted" aria-live="polite">
        {slide.caption}
      </figcaption>
    </figure>
  );
}
