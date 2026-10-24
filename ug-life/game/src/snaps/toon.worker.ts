import { toonify, type Img, type ToonOptions } from "./toon";

// Runs the filter off the main thread so the game keeps moving while a photo is processed.
self.onmessage = (e: MessageEvent<{ img: Img; options: ToonOptions }>) => {
  const out = toonify(e.data.img, e.data.options);
  (self as unknown as Worker).postMessage(out, [out.data.buffer]);
};
