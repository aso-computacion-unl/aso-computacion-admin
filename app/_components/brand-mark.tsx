import Image from "next/image";

import isotype from "@/components/brand/isotype.svg";
import logo from "@/components/brand/logo.svg";
import { cn } from "@/lib/utils";

/*
 * The brand SVGs paint their lettering white, which vanishes on the light surfaces. The light variants
 * (public/brand) repaint only that white in brand navy; the sky parts are the same. Both are in the markup
 * and CSS shows one (see `.theme-dark-only` in globals.css), so the right one is there before hydration.
 */

interface BrandMarkProps {
  alt?: string;
  className?: string;
}

export function BrandLogo({ alt = "", width, className }: BrandMarkProps & { width: number }) {
  return (
    <>
      <Image src={logo} alt={alt} width={width} priority className={cn("theme-dark-only", className)} />
      <Image
        src="/brand/logo-light.svg"
        alt={alt}
        width={width}
        height={Math.round((width * 390) / 392)}
        className={cn("theme-light-only", className)}
      />
    </>
  );
}

export function BrandIsotype({ width, height, className }: BrandMarkProps & { width: number; height: number }) {
  return (
    <>
      <Image src={isotype} alt="" width={width} height={height} priority className={cn("theme-dark-only", className)} />
      <Image
        src="/brand/isotype-light.svg"
        alt=""
        width={width}
        height={height}
        className={cn("theme-light-only", className)}
      />
    </>
  );
}
