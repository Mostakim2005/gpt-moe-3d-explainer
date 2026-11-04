import { useMemo } from 'react';
import * as THREE from 'three';

interface Props {
  text: string;
  position?: [number, number, number];
  /** World height of one line of text. */
  size?: number;
  color?: string;
  opacity?: number;
  weight?: number;
  align?: 'center' | 'left';
}

/**
 * Text drawn on a 2D canvas and mapped to a billboard sprite.
 *
 * Deliberately not drei's <Text>: troika fetches a font from a CDN on first use,
 * which would leave every token chip blank offline. Canvas text uses the local
 * font stack and needs no network at all.
 */
export function TextSprite({
  text,
  position = [0, 0, 0],
  size = 0.26,
  color = '#e6ecf7',
  opacity = 1,
  weight = 600,
  align = 'center',
}: Props) {
  const { texture, aspect } = useMemo(() => {
    const scale = 128;
    const font = `${weight} ${scale}px "Inter", "Segoe UI", system-ui, sans-serif`;
    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = font;
    const w = Math.max(8, Math.ceil(measure.measureText(text).width) + 16);
    const h = Math.ceil(scale * 1.36);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.font = font;
    ctx.textAlign = align === 'center' ? 'center' : 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, align === 'center' ? w / 2 : 8, h / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return { texture: tex, aspect: w / h };
  }, [text, color, weight, align]);

  const height = size * 1.36;
  const width = height * aspect;

  return (
    <sprite position={position} scale={[width, height, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}
