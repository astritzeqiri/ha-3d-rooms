/**
 * Wording and bar position for a room download.
 * `progress` is `{ index, count, loaded, total }`: room `index` of `count`,
 * with `loaded` of `total` bytes (total unknown for compressed transfers).
 */
export function loadProgress(progress) {
  const count = Math.max(1, progress?.count || 1),
    index = Math.min(count - 1, Math.max(0, progress?.index || 0)),
    loaded = Math.max(0, progress?.loaded || 0),
    total = progress?.total > 0 ? progress.total : undefined,
    part = total ? Math.min(1, loaded / total) : 0,
    megabytes = loaded / 1024 / 1024,
    size =
      megabytes >= 0.1
        ? ` · ${megabytes.toFixed(megabytes < 10 ? 1 : 0)} MB`
        : "";
  // One room without a known size has no meaningful position.
  const value = count > 1 || total ? (index + part) / count : undefined;
  return {
    value,
    text:
      count > 1
        ? `Downloading room ${index + 1} of ${count}…${total ? "" : size}`
        : total
          ? `Downloading your room… ${Math.round(part * 100)}%`
          : `Downloading your room…${size}`,
  };
}
