const PREVIEWABLE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"]);
export const isPreviewable = (extension) => PREVIEWABLE_EXTENSIONS.has(extension?.toLowerCase());

// Extensions HTML5 <video> can play natively across current browsers without a plugin/codec pack.
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".ogv", ".ogg", ".mov", ".m4v"]);
export const isVideo = (extension) => VIDEO_EXTENSIONS.has(extension?.toLowerCase());
