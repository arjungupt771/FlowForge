import sharp from "sharp";

export interface CropParams {
  /** Crop rectangle as percentages (0-100) of the source image, matching the UI sliders. */
  xPos: number;
  yPos: number;
  width: number;
  height: number;
}

/**
 * Resolve an image URL to raw bytes. Supports:
 *  - data: URLs (e.g. output of cropImage() below, or an uploaded image
 *    from the Request-Inputs node) — decoded in-memory, no network call.
 *  - http(s) URLs — fetched over the network.
 */
export async function fetchImageBuffer(url: string): Promise<Buffer> {
  if (!url) {
    throw new Error("No input image was provided.");
  }

  if (url.startsWith("data:")) {
    // No `s` (dotAll) flag needed: match against everything after the first
    // comma directly rather than trying to capture it with `.` in the regex.
    const header = /^data:([^;,]*)?(;base64)?,/.exec(url);
    if (!header) {
      throw new Error("Malformed data URL for input image.");
    }
    const data = url.slice(header[0].length);
    const isBase64 = !!header[2];
    return isBase64 ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf-8");
  }

  let resp: Response;
  try {
    resp = await fetch(url);
  } catch (err) {
    throw new Error(`Could not reach input image URL: ${(err as Error).message}`);
  }
  if (!resp.ok) {
    throw new Error(`Failed to fetch input image (HTTP ${resp.status} ${resp.statusText}).`);
  }
  const arrayBuf = await resp.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Crop an image for real using Sharp.
 *
 * The Crop Image node's UI expresses x/y/width/height as percentages
 * (0-100) of the source image, so those are converted to an absolute pixel
 * rectangle using the image's own metadata before cropping — this also
 * lets us validate the rectangle actually fits inside the image.
 *
 * No external object storage (S3, Transloadit, etc.) is configured for this
 * project, so the cropped result is returned as a data: URL. That keeps the
 * output immediately usable by downstream nodes (e.g. Gemini Vision, which
 * fetches this same URL via fetchImageBuffer) without needing a public host
 * or any filesystem writes, in both local dev and a serverless deployment.
 */
export async function cropImage(imageUrl: string, params: CropParams): Promise<string> {
  const buffer = await fetchImageBuffer(imageUrl);

  const image = sharp(buffer);
  const metadata = await image.metadata();
  const imgWidth = metadata.width;
  const imgHeight = metadata.height;

  if (!imgWidth || !imgHeight) {
    throw new Error("Could not read image dimensions — the input does not appear to be a valid image.");
  }

  if (!(params.width > 0) || !(params.height > 0)) {
    throw new Error("Crop width and height must both be greater than 0.");
  }
  if (params.xPos < 0 || params.yPos < 0) {
    throw new Error("Crop x/y position must not be negative.");
  }

  // Percentages -> absolute pixel rectangle against the real image size.
  const rect = {
    left: Math.round((params.xPos / 100) * imgWidth),
    top: Math.round((params.yPos / 100) * imgHeight),
    width: Math.max(1, Math.round((params.width / 100) * imgWidth)),
    height: Math.max(1, Math.round((params.height / 100) * imgHeight)),
  };

  // Clamp a rounding overshoot of a pixel or two at the edges rather than
  // hard-failing on an off-by-one; anything larger is a genuine validation error.
  const overshootX = rect.left + rect.width - imgWidth;
  const overshootY = rect.top + rect.height - imgHeight;
  if (overshootX > 2 || overshootY > 2) {
    throw new Error(
      `Crop rectangle (${rect.left},${rect.top} ${rect.width}x${rect.height}) exceeds image dimensions (${imgWidth}x${imgHeight}).`
    );
  }
  if (overshootX > 0) rect.width -= overshootX;
  if (overshootY > 0) rect.height -= overshootY;

  const outputBuffer = await image
    .extract(rect)
    .toFormat("png")
    .toBuffer();

  return `data:image/png;base64,${outputBuffer.toString("base64")}`;
}
