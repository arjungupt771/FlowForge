/**
 * Pre-built sample workflow matching the spec exactly:
 *
 * Request-Inputs.image_field → Crop#1.Input Image
 * Request-Inputs.image_field → Crop#2.Input Image  (fan-out from single source)
 * Request-Inputs.text_field  → Gemini#1.Prompt
 * Gemini#1.Response          → Gemini#2.Prompt
 * Crop#1.Output Image        → Final Gemini.Image (Vision)
 * Crop#2.Output Image        → Final Gemini.Image (Vision)
 * Gemini#2.Response          → Final Gemini.Prompt
 * Final Gemini.Response      → Response.result
 *
 * Execution order (per spec):
 *  T=0: Crop#1, Crop#2, Gemini#1 fire concurrently
 *  Gemini#2 starts when Gemini#1 finishes (not blocked by Crops)
 *  Final Gemini waits for both Crops + Gemini#2
 */

export const SAMPLE_WORKFLOW = {
  nodes: [
    {
      id: "request-inputs",
      type: "request-inputs",
      position: { x: 60, y: 280 },
      data: {
        label: "Request-Inputs",
        fields: [
          { id: "text_field",  type: "text_field",  label: "text_field",  value: "Describe what you see in the cropped images", connected: false },
          { id: "image_field", type: "image_field", label: "image_field", value: "", connected: false },
        ],
      },
    },
    {
      id: "crop-1",
      type: "crop-image",
      position: { x: 420, y: 100 },
      data: { label: "Crop Image #1", xPos: 0, yPos: 0, width: 50, height: 50, status: "idle" },
    },
    {
      id: "crop-2",
      type: "crop-image",
      position: { x: 420, y: 380 },
      data: { label: "Crop Image #2", xPos: 50, yPos: 50, width: 50, height: 50, status: "idle" },
    },
    {
      id: "gemini-1",
      type: "gemini",
      position: { x: 420, y: 640 },
      data: {
        label: "Gemini #1",
        model: "gemini-2.0-flash",
        prompt: "Summarise the following text briefly:",
        systemPrompt: "You are a concise summariser.",
        status: "idle",
      },
    },
    {
      id: "gemini-2",
      type: "gemini",
      position: { x: 780, y: 400 },
      data: {
        label: "Gemini #2",
        model: "gemini-2.0-flash",
        prompt: "",
        systemPrompt: "Expand the given summary with more detail.",
        status: "idle",
      },
    },
    {
      id: "gemini-final",
      type: "gemini",
      position: { x: 1140, y: 280 },
      data: {
        label: "Final Gemini",
        model: "gemini-2.0-flash",
        prompt: "",
        systemPrompt: "You are a vision + text analyst. Describe what you see in the images and relate it to the provided text.",
        status: "idle",
      },
    },
    {
      id: "response",
      type: "response",
      position: { x: 1500, y: 280 },
      data: { label: "Response", status: "idle" },
    },
  ],
  edges: [
    // image_field fans out to both crop nodes
    { id: "e1", source: "request-inputs", sourceHandle: "image_field", target: "crop-1",      targetHandle: "input-image",    animated: true, style: { stroke: "#7c3aed", strokeWidth: 2 } },
    { id: "e2", source: "request-inputs", sourceHandle: "image_field", target: "crop-2",      targetHandle: "input-image",    animated: true, style: { stroke: "#7c3aed", strokeWidth: 2 } },
    // text_field → Gemini#1 Prompt
    { id: "e3", source: "request-inputs", sourceHandle: "text_field",  target: "gemini-1",    targetHandle: "prompt",         animated: true, style: { stroke: "#7c3aed", strokeWidth: 2 } },
    // Gemini#1 → Gemini#2 Prompt
    { id: "e4", source: "gemini-1",       sourceHandle: "response-text", target: "gemini-2",  targetHandle: "prompt",         animated: true, style: { stroke: "#7c3aed", strokeWidth: 2 } },
    // Both crops → Final Gemini Vision
    { id: "e5", source: "crop-1",         sourceHandle: "output-image", target: "gemini-final", targetHandle: "vision",       animated: true, style: { stroke: "#7c3aed", strokeWidth: 2 } },
    { id: "e6", source: "crop-2",         sourceHandle: "output-image", target: "gemini-final", targetHandle: "vision",       animated: true, style: { stroke: "#7c3aed", strokeWidth: 2 } },
    // Gemini#2 → Final Gemini Prompt
    { id: "e7", source: "gemini-2",       sourceHandle: "response-text", target: "gemini-final", targetHandle: "prompt",      animated: true, style: { stroke: "#7c3aed", strokeWidth: 2 } },
    // Final Gemini → Response
    { id: "e8", source: "gemini-final",   sourceHandle: "response-text", target: "response",  targetHandle: "result",         animated: true, style: { stroke: "#7c3aed", strokeWidth: 2 } },
  ],
};
