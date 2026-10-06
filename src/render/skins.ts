import run1Url from '../assets/codmos/run-1.webp';
import run2Url from '../assets/codmos/run-2.webp';
import run3Url from '../assets/codmos/run-3.webp';
import run4Url from '../assets/codmos/run-4.webp';
import run5Url from '../assets/codmos/run-5.webp';
import run6Url from '../assets/codmos/run-6.webp';
import sideUrl from '../assets/codmos/side.webp';
import squatUrl from '../assets/codmos/squat.webp';
import blockedUrl from '../assets/codmos/blocked.webp';
import canyonLeftUrl from '../assets/codmos/canyon-left.webp';
import canyonRightUrl from '../assets/codmos/canyon-right.webp';
import archUrl from '../assets/codmos/arch.webp';
import gateUrl from '../assets/codmos/gate.webp';
import pillarUrl from '../assets/codmos/pillar.webp';
import dustLeftUrl from '../assets/codmos/dust-left.webp';
import dustRightUrl from '../assets/codmos/dust-right.webp';
import cloudLargeUrl from '../assets/codmos/cloud-large.webp';
import cloudSmallUrl from '../assets/codmos/cloud-small.webp';

/** 볼타 러너 맵에 쓰는 그림. 출처는 코드모스 'AI체험 동작인식' 콘텐츠의 mission4 에셋입니다. */
export interface VoltaArt {
  run: HTMLImageElement[];
  /** 제트팩을 켠 모습. 니트로를 쓸 때 보여 줍니다. */
  jet: HTMLImageElement;
  squat: HTMLImageElement;
  blocked: HTMLImageElement;
  canyonLeft: HTMLImageElement;
  canyonRight: HTMLImageElement;
  arch: HTMLImageElement;
  gate: HTMLImageElement;
  pillar: HTMLImageElement;
  dustLeft: HTMLImageElement;
  dustRight: HTMLImageElement;
  cloudLarge: HTMLImageElement;
  cloudSmall: HTMLImageElement;
}

function load(src: string): HTMLImageElement {
  const image = new Image();
  image.src = src;
  return image;
}

let art: VoltaArt | null = null;

/** 그림을 처음 쓸 때 불러옵니다. 테스트처럼 브라우저가 아닌 환경에서는 부르지 않습니다. */
export function voltaArt(): VoltaArt {
  art ??= {
    run: [run1Url, run2Url, run3Url, run4Url, run5Url, run6Url].map(load),
    jet: load(sideUrl),
    squat: load(squatUrl),
    blocked: load(blockedUrl),
    canyonLeft: load(canyonLeftUrl),
    canyonRight: load(canyonRightUrl),
    arch: load(archUrl),
    gate: load(gateUrl),
    pillar: load(pillarUrl),
    dustLeft: load(dustLeftUrl),
    dustRight: load(dustRightUrl),
    cloudLarge: load(cloudLargeUrl),
    cloudSmall: load(cloudSmallUrl),
  };
  return art;
}

/**
 * 가로 가운데가 cx, 아래쪽 끝이 bottom이고 너비가 width인 크기로 그림을 그립니다.
 * 아직 불러오지 못한 그림은 건너뜁니다.
 */
export function drawImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cx: number,
  bottom: number,
  width: number,
): void {
  if (!image.complete || image.naturalWidth === 0 || width < 1) return;
  const height = (width * image.naturalHeight) / image.naturalWidth;
  ctx.drawImage(image, cx - width / 2, bottom - height, width, height);
}
