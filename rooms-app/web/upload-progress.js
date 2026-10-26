export function uploadProgress(prefix) {
  const box = document.getElementById(`${prefix}-progress`);
  const bar = box.querySelector("progress");
  const label = box.querySelector("[data-upload-label]");
  const detail = box.querySelector("[data-upload-detail]");
  const stage = (text, extra = "") => {
    box.hidden = false;
    label.textContent = text;
    detail.textContent = extra;
    bar.removeAttribute("value");
  };
  stage("Uploading model… 0%");
  bar.value = 0;
  return {
    onProgress({ loaded, total }) {
      if (total) {
        const percent = Math.min(100, Math.floor((loaded / total) * 100));
        bar.value = percent;
        label.textContent = `Uploading model… ${percent}%`;
        detail.textContent = `${(loaded / 1024 / 1024).toFixed(1)} of ${(total / 1024 / 1024).toFixed(1)} MB`;
      } else
        stage(
          "Uploading model…",
          `${(loaded / 1024 / 1024).toFixed(1)} MB sent`,
        );
    },
    onUploaded() {
      stage(
        "Upload complete · Processing model…",
        "Checking and saving the room.",
      );
    },
    preparing() {
      stage("Preparing 3D view…");
    },
    complete() {
      stage("Model ready");
      bar.value = 100;
    },
    failed() {
      stage(
        "Upload could not be completed",
        "See the error below and try again.",
      );
      bar.value = 0;
    },
  };
}
