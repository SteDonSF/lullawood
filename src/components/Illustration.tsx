import Image from "next/image";

type Props = {
  /** file under /public/art, without extension, e.g. "hero" */
  slot: string;
  alt: string;
  width: number;
  height: number;
  /** when true, shows the dashed placeholder instead of an <Image> */
  placeholder?: boolean;
  className?: string;
  priority?: boolean;
  rounded?: string;
};

/**
 * ART SLOT. While `placeholder` is true you'll see a labelled frame with the
 * exact spec. To go live: add /public/art/<slot>.webp and set placeholder={false}.
 */
export function Illustration({ slot, alt, width, height, placeholder = true, className = "", priority, rounded = "rounded-2xl" }: Props) {
  if (placeholder) {
    return (
      <div
        className={`flex items-center justify-center border border-dashed border-gold-deep/50 bg-cream-paper/50 text-ink-muted text-center ${rounded} ${className}`}
        style={{ aspectRatio: `${width} / ${height}` }}
        role="img"
        aria-label={`${alt} (illustration placeholder)`}
      >
        <span className="px-4 text-[11px] font-bold tracking-wide leading-relaxed">
          ✦ Art slot ✦<br />{slot} · {width}×{height}
          <br /><span className="font-normal opacity-70">{alt}</span>
        </span>
      </div>
    );
  }
  return (
    <Image src={`/art/${slot}.webp`} alt={alt} width={width} height={height}
      priority={priority} className={`${rounded} ${className} object-cover`} />
  );
}
