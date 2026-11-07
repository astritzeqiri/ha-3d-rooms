/** Search a native select's options without changing its value until committed. */
export function searchableSelect(select, label) {
  const host = document.createElement("div");
  host.className = "searchable-select";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.id = `${select.id}-trigger`;
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-labelledby", `${label.id} ${trigger.id}`);
  const pop = document.createElement("div");
  pop.className = "searchable-select-pop";
  pop.hidden = true;
  const input = document.createElement("input");
  input.type = "search";
  input.autocomplete = "off";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  const list = document.createElement("ul");
  list.id = `${select.id}-results`;
  list.setAttribute("role", "listbox");
  input.setAttribute("aria-controls", list.id);
  trigger.setAttribute("aria-controls", list.id);
  const status = document.createElement("p");
  status.className = "muted small";
  status.setAttribute("role", "status");
  pop.append(input, list, status);
  host.append(trigger, pop);
  select.after(host);
  select.hidden = true;
  label.htmlFor = trigger.id;
  let matches = [],
    active = -1;
  function highlight(index) {
    active = matches.length ? (index + matches.length) % matches.length : -1;
    [...list.children].forEach((row, i) =>
      row.classList.toggle("active", i === active),
    );
    if (active < 0) input.removeAttribute("aria-activedescendant");
    else {
      input.setAttribute("aria-activedescendant", list.children[active].id);
      list.children[active].scrollIntoView({ block: "nearest" });
    }
  }
  function close(restore = false) {
    pop.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    if (restore) trigger.focus();
  }
  function commit(index) {
    if (select.disabled || !matches[index]) return;
    select.value = matches[index].value;
    trigger.textContent = matches[index].text;
    close(true);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function render() {
    const query = input.value.trim().toLocaleLowerCase();
    matches = [...select.options].filter(
      (option) =>
        !option.disabled && option.text.toLocaleLowerCase().includes(query),
    );
    list.replaceChildren(
      ...matches.map((option, index) => {
        const row = document.createElement("li");
        row.id = `${list.id}-${index}`;
        row.setAttribute("role", "option");
        row.setAttribute(
          "aria-selected",
          String(option.value === select.value),
        );
        row.textContent = option.text;
        row.addEventListener("pointerdown", (event) => event.preventDefault());
        row.onclick = () => commit(index);
        return row;
      }),
    );
    status.textContent = matches.length
      ? `${matches.length} ${matches.length === 1 ? "match" : "matches"}`
      : "No matches. Try another search.";
    highlight(
      Math.max(
        0,
        matches.findIndex((option) => option.value === select.value),
      ),
    );
  }
  function open() {
    if (select.disabled) return;
    pop.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-expanded", "true");
    input.value = "";
    render();
    input.focus();
  }
  trigger.onclick = () => (pop.hidden ? open() : close());
  trigger.onkeydown = (event) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      open();
    }
  };
  input.oninput = render;
  input.onkeydown = (event) => {
    if (event.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      highlight(active + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") close();
  };
  document.addEventListener("pointerdown", (event) => {
    if (!host.contains(event.target)) close();
  });
  host.addEventListener("focusout", (event) => {
    if (!host.contains(event.relatedTarget)) close();
  });
  select.closest("dialog")?.addEventListener("close", () => close());
  function refresh() {
    close();
    trigger.textContent = select.selectedOptions[0]?.text || "Choose a space";
    trigger.disabled = select.disabled || !select.options.length;
    input.placeholder = `Search ${label.textContent.trim().toLocaleLowerCase()}s…`;
    input.setAttribute(
      "aria-label",
      `Search ${label.textContent.trim().toLocaleLowerCase()}s`,
    );
    list.setAttribute("aria-label", label.textContent.trim());
  }
  refresh();
  return { refresh };
}
