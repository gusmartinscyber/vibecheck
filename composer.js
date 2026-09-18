// Composer discovery helpers shared by the content script and unit tests.
// X often keeps multiple composers mounted at once, so every operation must be
// scoped to the composer the user is actually editing.
(function initComposerHelpers(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VIBECHECK_COMPOSER = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  // X also has data-testid="tweetTextarea_0_label" (the placeholder) and
  // "...RichTextInputContainer" (a wrapper); only accept role=textbox nodes.
  const TEXTBOX_SEL =
    '[data-testid^="tweetTextarea_"][role="textbox"], [data-testid^="tweetTextarea_"]:not([data-testid$="_label"]) [role="textbox"]';

  function findTextboxes(scope = document) {
    const seen = new Set();
    const out = [];
    for (const el of scope.querySelectorAll(TEXTBOX_SEL)) {
      const textbox =
        el.getAttribute("role") === "textbox" ? el : el.querySelector('[role="textbox"]');
      if (!textbox || seen.has(textbox)) continue;
      seen.add(textbox);
      out.push(textbox);
    }
    return out;
  }

  function getDraftParts(textbox) {
    if (!textbox) return [];

    // Multiple textboxes inside one compose dialog are the parts of a thread.
    // Standalone editors (Home and inline replies) are independent even when X
    // leaves several of them mounted in the document at the same time.
    const dialog = textbox.closest('[role="dialog"]');
    const textboxes = dialog ? findTextboxes(dialog) : [textbox];
    return textboxes
      .map((item) => (item.innerText || item.textContent || "").replace(/\u00a0/g, " ").trim())
      .filter(Boolean);
  }

  function pickTextbox(textboxes, activeElement, currentHost, findHost) {
    const items = Array.from(textboxes || []);
    if (!items.length) return null;

    // Focus is the strongest signal: it follows the composer the user selected,
    // including a newly opened reply/quote dialog over the Home composer.
    const focused = items.find(
      (textbox) => textbox === activeElement || textbox.contains?.(activeElement)
    );
    if (focused) return focused;

    // When focus moves to a toolbar button, keep the panel with its composer.
    if (currentHost && typeof findHost === "function") {
      const attached = items.find((textbox) => findHost(textbox) === currentHost);
      if (attached) return attached;
    }

    // An open compose dialog should win over a background inline composer. Use
    // its last textbox because that is the active part when extending a thread.
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].closest('[role="dialog"]')) return items[i];
    }
    return items[0];
  }

  function getComposerScope(textbox, host) {
    if (!textbox) return null;
    const dialog = textbox.closest('[role="dialog"]');
    if (dialog) return dialog;

    // For an inline composer, the smallest ancestor containing both the editor
    // and its toolbar excludes media attached to other mounted composers.
    if (!host || host === textbox) return textbox.parentElement || textbox;
    let scope = textbox;
    while (scope && !scope.contains?.(host)) scope = scope.parentElement;
    return scope || textbox.parentElement || textbox;
  }

  return Object.freeze({
    TEXTBOX_SEL,
    findTextboxes,
    getDraftParts,
    pickTextbox,
    getComposerScope,
  });
});
