const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TEXTBOX_SEL,
  findTextboxes,
  getDraftParts,
  pickTextbox,
  getComposerScope,
} = require("../composer.js");

class FakeElement {
  constructor({ name = "element", role = "", testId = "", text = "" } = {}) {
    this.name = name;
    this.role = role;
    this.testId = testId;
    this.innerText = text;
    this.textContent = text;
    this.parentElement = null;
    this.children = [];
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
    return this;
  }

  getAttribute(name) {
    if (name === "role") return this.role || null;
    if (name === "data-testid") return this.testId || null;
    return null;
  }

  contains(node) {
    for (let current = node; current; current = current.parentElement) {
      if (current === this) return true;
    }
    return false;
  }

  closest(selector) {
    if (selector !== '[role="dialog"]') return null;
    for (let current = this; current; current = current.parentElement) {
      if (current.role === "dialog") return current;
    }
    return null;
  }

  querySelector(selector) {
    if (selector !== '[role="textbox"]') return null;
    return this.descendants().find((item) => item.role === "textbox") || null;
  }

  querySelectorAll(selector) {
    assert.equal(selector, TEXTBOX_SEL);
    return this.descendants().filter((item) => {
      if (item.role !== "textbox") return false;
      if (item.testId.startsWith("tweetTextarea_")) return true;
      for (let parent = item.parentElement; parent && parent !== this.parentElement; parent = parent.parentElement) {
        if (parent.testId.startsWith("tweetTextarea_") && !parent.testId.endsWith("_label")) {
          return true;
        }
      }
      return false;
    });
  }

  descendants() {
    const out = [];
    const visit = (node) => {
      for (const child of node.children) {
        out.push(child);
        visit(child);
      }
    };
    visit(this);
    return out;
  }
}

function textbox(name, text) {
  return new FakeElement({ name, role: "textbox", testId: `tweetTextarea_${name}`, text });
}

test("findTextboxes returns only real X editors in document order", () => {
  const document = new FakeElement({ name: "document" });
  const first = textbox("first", "one");
  const label = new FakeElement({
    name: "label",
    testId: "tweetTextarea_0_label",
    text: "placeholder",
  });
  const wrapper = new FakeElement({ name: "wrapper", testId: "tweetTextarea_1" });
  const nested = new FakeElement({ name: "nested", role: "textbox", text: "two" });
  wrapper.append(nested);
  document.append(first, label, wrapper);

  assert.deepEqual(findTextboxes(document), [first, nested]);
});

test("standalone composers never become accidental thread parts", () => {
  const document = new FakeElement({ name: "document" });
  const home = textbox("home", "unfinished home draft");
  const reply = textbox("reply", "the reply being edited");
  document.append(home, reply);

  assert.deepEqual(getDraftParts(reply), ["the reply being edited"]);
});

test("thread parts in the same compose dialog stay grouped", () => {
  const dialog = new FakeElement({ name: "dialog", role: "dialog" });
  const first = textbox("0", " first\u00a0part ");
  const second = textbox("1", "second part");
  const empty = textbox("2", "   ");
  dialog.append(first, second, empty);

  assert.deepEqual(getDraftParts(second), ["first part", "second part"]);
});

test("focused composer wins over background and dialog editors", () => {
  const document = new FakeElement({ name: "document" });
  const home = textbox("home", "home");
  const dialog = new FakeElement({ name: "dialog", role: "dialog" });
  const reply = textbox("reply", "reply");
  const caret = new FakeElement({ name: "caret" });
  reply.append(caret);
  dialog.append(reply);
  document.append(home, dialog);

  assert.equal(pickTextbox([home, reply], caret, null, () => null), reply);
});

test("current composer stays selected when focus moves to its toolbar", () => {
  const first = textbox("first", "first");
  const second = textbox("second", "second");
  const firstHost = new FakeElement({ name: "first toolbar" });
  const secondHost = new FakeElement({ name: "second toolbar" });
  const hosts = new Map([[first, firstHost], [second, secondHost]]);

  assert.equal(
    pickTextbox([first, second], null, secondHost, (item) => hosts.get(item)),
    second
  );
});

test("last dialog editor wins when there is no focus or current host", () => {
  const document = new FakeElement({ name: "document" });
  const home = textbox("home", "home");
  const dialog = new FakeElement({ name: "dialog", role: "dialog" });
  const firstPart = textbox("0", "one");
  const lastPart = textbox("1", "two");
  dialog.append(firstPart, lastPart);
  document.append(home, dialog);

  assert.equal(pickTextbox([home, firstPart, lastPart], null, null, () => null), lastPart);
});

test("inline media scope is the smallest shared editor/toolbar ancestor", () => {
  const page = new FakeElement({ name: "page" });
  const composer = new FakeElement({ name: "composer" });
  const editorWrap = new FakeElement({ name: "editor wrapper" });
  const controls = new FakeElement({ name: "controls" });
  const editor = textbox("home", "draft");
  const toolbar = new FakeElement({ name: "toolbar" });
  editorWrap.append(editor);
  controls.append(toolbar);
  composer.append(editorWrap, controls);
  page.append(composer);

  assert.equal(getComposerScope(editor, toolbar), composer);
});

test("compose dialogs are the media scope for full threads", () => {
  const dialog = new FakeElement({ name: "dialog", role: "dialog" });
  const editor = textbox("0", "draft");
  const toolbar = new FakeElement({ name: "toolbar" });
  dialog.append(editor, toolbar);

  assert.equal(getComposerScope(editor, toolbar), dialog);
});
