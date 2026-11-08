/** Room settings card for lighter copies, plus a one-at-a-time background queue. */
const megabytes = (bytes) =>
  bytes == null ? "—" : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function describeOptimization(status) {
  const { full, phone } = status.variants;
  const sizes = `Upload ${megabytes(status.original)} · desktop ${megabytes(full.bytes)} · phone ${megabytes(phone.bytes)}`;
  if (full.kind === "web" && phone.kind === "web")
    return {
      done: true,
      text: `Fully optimized: compressed geometry and GPU textures. ${sizes}.`,
    };
  if (full.kind === "none" || phone.kind === "none")
    return {
      done: false,
      text: `Home Assistant is preparing lighter copies of this room. ${sizes}.`,
    };
  return {
    done: false,
    text: `Textures are optimized on Home Assistant. Optimize here to also compress geometry and use GPU textures. ${sizes}.`,
  };
}

export function createOptimizePanel({ $, optimizer, toast, current, onDone }) {
  const queue = [];
  let running = null;
  const busy = (id) => running === id || queue.includes(id);

  async function render(model = current()) {
    const card = $("optimize-card");
    card.hidden = !optimizer || !model || model.houseView;
    if (card.hidden) return;
    $("optimize-error").textContent = "";
    $("optimize-room").disabled = busy(model.id);
    if (busy(model.id)) return;
    try {
      const info = describeOptimization(await optimizer.optimization(model.id));
      if (current()?.id !== model.id) return;
      $("optimize-status").textContent = info.text;
      $("optimize-room").textContent = info.done
        ? "Optimize again"
        : "Optimize for phones and desktops";
    } catch (error) {
      $("optimize-status").textContent = "";
      $("optimize-error").textContent = error.message;
    }
  }

  async function next() {
    if (running || !queue.length) return;
    running = queue.shift();
    const id = running;
    const { optimizeRoom } = await import("./room-optimizer.js");
    const progress = $("optimize-progress");
    const visible = () => current()?.id === id;
    try {
      if (visible()) {
        progress.hidden = false;
        $("optimize-room").disabled = true;
      }
      await optimizeRoom(
        optimizer,
        { id },
        {
          onProgress: ({ fraction, variant, uploading }) => {
            if (!visible()) return;
            progress.hidden = false;
            progress.value = Math.round(fraction * 100);
            $("optimize-status").textContent = uploading
              ? `Saving the ${variant} copy…`
              : variant
                ? `Optimizing the ${variant} copy… ${Math.round(fraction * 100)}%`
                : "Finishing…";
          },
        },
      );
      toast("Room optimized for faster loading.");
      await onDone?.(id);
    } catch (error) {
      if (visible()) $("optimize-error").textContent = error.message;
      else toast(`Could not optimize a room: ${error.message}`);
    } finally {
      running = null;
      progress.hidden = true;
      if (visible()) await render();
      next();
    }
  }

  function add(ids) {
    if (!optimizer) return;
    for (const id of [].concat(ids || [])) if (id && !busy(id)) queue.push(id);
    render();
    next();
  }

  $("optimize-room")?.addEventListener("click", () => {
    const model = current();
    if (model && !model.houseView) add(model.id);
  });
  return { render, add, busy };
}
