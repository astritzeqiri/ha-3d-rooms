/** Browser-reported byte progress; completion still waits for server validation. */
export function uploadJSON(
  url,
  {
    method = "POST",
    file,
    headers = {},
    onProgress = () => {},
    onUploaded = () => {},
    createXHR = () => new XMLHttpRequest(),
  },
) {
  return new Promise((resolve, reject) => {
    const xhr = createXHR();
    xhr.open(method, url);
    for (const [key, value] of Object.entries(headers))
      xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) =>
      onProgress({
        loaded: event.loaded,
        total: event.lengthComputable ? event.total : null,
      });
    xhr.upload.onload = () => onUploaded();
    xhr.onerror = () =>
      reject(
        new Error("Upload interrupted. Check your connection and try again."),
      );
    xhr.onabort = () =>
      reject(new Error("Upload cancelled. You can try again."));
    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data) resolve(data);
      else
        reject(
          new Error(
            data?.error || `Upload failed (${xhr.status}). Please try again.`,
          ),
        );
    };
    xhr.send(file);
  });
}
/** Keep credentials in the HA parent document and restrict their destination. */
export async function uploadNativeModel(hass, path, options) {
  if (!(
    (path === "/api/three_d_rooms/models" && options.method === "POST") ||
    (/^\/api\/three_d_rooms\/models\/[a-z0-9_-]+$/.test(path) &&
      options.method === "PUT")
  ))
    throw new Error("Unknown model upload.");
  if (hass.auth.expired) await hass.auth.refreshAccessToken();
  return uploadJSON(path, {
    ...options,
    headers: {
      "Content-Type": "application/zip",
      Authorization: `Bearer ${hass.auth.accessToken}`,
    },
  });
}
