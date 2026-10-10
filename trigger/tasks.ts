import { task, logger } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchImageBuffer, cropImage } from "../lib/image-processing";

// ─── Gemini Task ─────────────────────────────────────────────────────────────

export const geminiTask = task({
  id: "gemini-inference",
  retry: { maxAttempts: 2, minTimeoutInMs: 1000, factor: 2 },
  run: async (payload: {
    model: string;
    prompt: string;
    systemPrompt?: string;
    visionUrls?: string[];
    temperature?: number;
    maxTokens?: number;
  }) => {
    logger.info("Gemini task starting", { model: payload.model });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: payload.model ?? "gemini-2.0-flash",
      generationConfig: {
        temperature: payload.temperature ?? 0.7,
        maxOutputTokens: payload.maxTokens ?? 1024,
      },
    });

    const parts: Array<
      | { text: string }
      | { inlineData: { data: string; mimeType: string } }
    > = [];

    if (payload.systemPrompt) {
      parts.push({ text: `System: ${payload.systemPrompt}\n\n` });
    }

    for (const url of payload.visionUrls ?? []) {
      try {
        const buf = await fetchImageBuffer(url);
        const mimeType = url.startsWith("data:")
          ? (/^data:([^;,]+)/.exec(url)?.[1] ?? "image/png")
          : "image/jpeg";
        parts.push({ inlineData: { data: buf.toString("base64"), mimeType } });
        logger.info("Vision image attached", { mimeType });
      } catch (err) {
        // A vision image failing to resolve should not silently vanish from
        // the record — log it clearly. The Gemini call still proceeds with
        // whatever images did resolve, plus the prompt text.
        logger.warn("Failed to fetch vision image", { url, err: String(err) });
      }
    }

    parts.push({ text: payload.prompt || "Describe the input." });

    const result = await model.generateContent(parts);
    const text = result.response.text();

    logger.info("Gemini task done", { chars: text.length });
    return { output: text };
  },
});

// ─── Crop Image Task ──────────────────────────────────────────────────────────

export const cropImageTask = task({
  id: "crop-image",
  machine: { preset: "small-1x" },
  retry: { maxAttempts: 2, minTimeoutInMs: 1000, factor: 2 },
  run: async (payload: {
    imageUrl: string;
    xPos: number;
    yPos: number;
    width: number;
    height: number;
    nodeId: string;
  }) => {
    logger.info("Crop image task starting", { nodeId: payload.nodeId });

    // Real crop: fetch the image, read its actual dimensions, convert the
    // UI's percentage-based rectangle to pixels, validate it, and extract
    // it with Sharp. See lib/image-processing.ts for the full pipeline.
    const outputUrl = await cropImage(payload.imageUrl, {
      xPos: payload.xPos,
      yPos: payload.yPos,
      width: payload.width,
      height: payload.height,
    });

    logger.info("Crop image task done", { nodeId: payload.nodeId });
    return { outputUrl };
  },
});
