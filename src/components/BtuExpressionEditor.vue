<template>
  <div class="btu-editor-wrapper">
    <div
      ref="editorRef"
      class="btu-editor-content"
      contenteditable="true"
      placeholder="输入 '/' 唤起指令菜单"
      @input="onInput"
      @keydown="onKeydown"
      @keyup="onKeyup"
      @mouseup="updateCursor"
      @paste="onPaste"
      @change="onDelegatedChange"
    ></div>

    <!-- Slash Menu -->
    <ul
      v-if="showMenu"
      class="slash-menu"
      :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }"
    >
      <li
        v-for="(item, idx) in menuItems"
        :key="item.type"
        :class="{ active: idx === activeMenuIndex }"
        @click="selectMenuItem(item)"
        @mouseenter="activeMenuIndex = idx"
      >
        <span class="menu-icon">{{ item.icon }}</span>
        <div class="menu-text">
          <div class="menu-title">{{ item.label }}</div>
          <div class="menu-sub">{{ item.desc }}</div>
        </div>
      </li>
    </ul>

    <!-- Hidden file inputs -->
    <input
      type="file"
      ref="imageUploadRef"
      accept="image/*"
      style="display: none"
      @change="onImageUpload"
    />
    <input
      type="file"
      ref="videoUploadRef"
      accept="video/*"
      style="display: none"
      @change="onVideoUpload"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from "vue";

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue"]);

const editorRef = ref(null);
const showMenu = ref(false);
const menuPos = ref({ x: 0, y: 0 });
const activeMenuIndex = ref(0);

const imageUploadRef = ref(null);
const videoUploadRef = ref(null);

const menuItems = [
  {
    type: "attrInput",
    icon: "🔢",
    label: "输入值属性",
    desc: "插入带输入框的组件，配置数值类参数",
  },
  {
    type: "attrOption",
    icon: "🔽",
    label: "可选值属性",
    desc: "插入带下拉选择的预设列表项",
  },
  { type: "function", icon: "ƒ", label: "业务函数", desc: "插入业务计算函数" },
  {
    type: "operator",
    icon: "±",
    label: "操作符",
    desc: "插入+ - * / > <等数学逻辑符号",
  },
  { type: "image", icon: "🖼️", label: "图片组件", desc: "上传本地图片" },
  { type: "video", icon: "🎬", label: "视频组件", desc: "上传本地视频" },
];

let savedRange = null;

// Parse XML -> HTML
function xmlToHtml(xmlStr) {
  if (!xmlStr) return "";
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(`<root>${xmlStr}</root>`, "text/xml");
  if (xmlDoc.querySelector("parsererror")) {
    return xmlStr; // fallback to raw string if XML error
  }

  let html = "";
  const root = xmlDoc.documentElement;

  const processNode = (node) => {
    if (node.nodeType === 3) {
      if (!node.nodeValue.trim() && node.nodeValue.includes("\n")) return "";
      return node.nodeValue; // text
    }
    if (node.nodeType === 1) {
      const tag = node.tagName;
      if (tag === "attrInput") {
        const val = node.getAttribute("value") || "";
        const unit = node.getAttribute("unit") || "";
        return (
          `<span data-widget="attrInput" contenteditable="false" class="widget widget-input">` +
          `<input type="number" class="live-input val-input" value="${val}" placeholder="0" />` +
          `<input type="text" class="live-input unit-input" value="${unit}" placeholder="单位" />` +
          `</span>`
        );
      } else if (tag === "attrOption") {
        const val = node.getAttribute("value") || "";
        let optionsHtml = ["seedA", "seedB", "soilA"]
          .map(
            (opt) =>
              `<option value="${opt}" ${
                val === opt ? "selected" : ""
              }>${opt}</option>`
          )
          .join("");
        return (
          `<span data-widget="attrOption" contenteditable="false" class="widget widget-select">` +
          `<select class="live-select"><option value="">请选择</option>${optionsHtml}</select></span>`
        );
      } else if (tag === "function") {
        const name = node.getAttribute("name") || "";
        return (
          `<span data-widget="function" contenteditable="false" class="widget widget-function">` +
          `ƒ <input type="text" class="live-input fn-input" value="${name}" placeholder="函数名"/>()</span>`
        );
      } else if (tag === "operator") {
        const val = node.getAttribute("value") || "";
        return (
          `<span data-widget="operator" contenteditable="false" class="widget widget-operator">` +
          `<input type="text" class="live-input op-input" value="${val}" maxlength="2" placeholder="+"/></span>`
        );
      } else if (tag === "image") {
        const src = node.getAttribute("src") || "";
        const name = node.getAttribute("name") || "";
        return (
          `<span data-widget="image" contenteditable="false" class="widget widget-image">` +
          `<img src="${src}" alt="${name}" />` +
          `</span>`
        );
      } else if (tag === "video") {
        const src = node.getAttribute("src") || "";
        const name = node.getAttribute("name") || "";
        return (
          `<span data-widget="video" contenteditable="false" class="widget widget-video">` +
          `<video src="${src}"></video><span class="media-name">🎥 ${name}</span>` +
          `</span>`
        );
      } else if (tag === "br") {
        return "<br/>";
      }

      // Recursively process children
      let res = "";
      for (const child of node.childNodes) res += processNode(child);
      return res;
    }
    return "";
  };

  for (const child of root.childNodes) {
    html += processNode(child);
  }
  return html;
}

// Parse HTML -> XML
function htmlToXml() {
  if (!editorRef.value) return "";

  function processNode(node) {
    if (node.nodeType === 3) {
      // Escape xml entities
      return node.nodeValue
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
    if (node.nodeType === 1) {
      // Element
      const widgetStr = node.getAttribute("data-widget");
      if (widgetStr === "attrInput") {
        const val = node.querySelector(".val-input")?.value || "";
        const unit = node.querySelector(".unit-input")?.value || "";
        return `<attrInput value="${val}" unit="${unit}"/>`;
      } else if (widgetStr === "attrOption") {
        const val = node.querySelector(".live-select")?.value || "";
        return `<attrOption value="${val}"/>`;
      } else if (widgetStr === "function") {
        const name = node.querySelector(".fn-input")?.value || "";
        return `<function name="${name}"/>`;
      } else if (widgetStr === "operator") {
        const op = node.querySelector(".op-input")?.value || "";
        return `<operator value="${op}"/>`;
      } else if (widgetStr === "image") {
        const img = node.querySelector("img");
        return `<image src="${img?.getAttribute("src") || ""}" name="${
          img?.getAttribute("alt") || ""
        }"/>`;
      } else if (widgetStr === "video") {
        const vid = node.querySelector("video");
        const nameNode = node.querySelector(".media-name");
        return `<video src="${vid?.getAttribute("src") || ""}" name="${
          nameNode?.textContent.replace("🎥 ", "") || ""
        }"/>`;
      } else if (node.tagName === "BR") {
        return "<br/>";
      } else if (node.tagName === "DIV" || node.tagName === "P") {
        let res = "";
        for (const child of node.childNodes) res += processNode(child);
        return res + "<br/>";
      }

      let res = "";
      for (const child of node.childNodes) res += processNode(child);
      return res;
    }
    return "";
  }

  let xml = "";
  for (const child of editorRef.value.childNodes) {
    xml += processNode(child);
  }
  return xml;
}

// Trigger update
function updateValue() {
  const xml = htmlToXml();
  emit("update:modelValue", xml);
}

// Delegated change explicitly catches input/change on widget fields
function onDelegatedChange(e) {
  if (e.target.matches(".live-input") || e.target.matches(".live-select")) {
    updateValue();
  }
}

let isComposing = false;
let isInternallyChanging = false;

watch(
  () => props.modelValue,
  (newVal) => {
    if (isInternallyChanging) return;
    if (!editorRef.value) return;
    const currentXml = htmlToXml();
    if (currentXml !== newVal) {
      editorRef.value.innerHTML = xmlToHtml(newVal);
    }
  }
);

onMounted(() => {
  if (props.modelValue) {
    editorRef.value.innerHTML = xmlToHtml(props.modelValue);
  }
  editorRef.value.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  editorRef.value.addEventListener("compositionend", (e) => {
    isComposing = false;
    onInput(e);
  });

  // To handle the live input events (DOM change event doesn't bubble inputs as elegantly in all cases)
  editorRef.value.addEventListener("input", (e) => {
    if (e.target.matches(".live-input") || e.target.matches(".live-select")) {
      updateValue();
    }
  });
});

// Editor interactions
function updateCursor() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    // Find if slash is before cursor
    const textNode = range.startContainer;
    if (textNode.nodeType === 3) {
      const text = textNode.textContent.slice(0, range.startOffset);
      if (text.endsWith("/")) {
        const rect = range.getBoundingClientRect();
        menuPos.value = {
          x: rect.left,
          y: rect.bottom,
        };
        showMenu.value = true;
        savedRange = range.cloneRange();
        return;
      }
    }
  }
  showMenu.value = false;
}

function onInput(e) {
  if (isComposing) return;

  // We don't want to trigger model update if the input came from menu replacing text
  isInternallyChanging = true;
  updateValue();
  isInternallyChanging = false;

  updateCursor();
}

function onKeydown(e) {
  if (showMenu.value) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeMenuIndex.value = (activeMenuIndex.value + 1) % menuItems.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeMenuIndex.value =
        (activeMenuIndex.value - 1 + menuItems.length) % menuItems.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectMenuItem(menuItems[activeMenuIndex.value]);
    } else if (e.key === "Escape") {
      showMenu.value = false;
    }
  }
}

function onKeyup(e) {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    updateCursor();
  }
}

function onPaste(e) {
  e.preventDefault();
  const text = (e.originalEvent || e).clipboardData.getData("text/plain");
  document.execCommand("insertText", false, text);
}

function selectMenuItem(item) {
  showMenu.value = false;

  if (savedRange && editorRef.value) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);

    // delete the '/' character
    document.execCommand("delete", false);
    savedRange = null;
  }

  const span = document.createElement("span");

  if (item.type === "attrInput") {
    span.innerHTML = xmlToHtml('<attrInput value="" unit=""/>');
    insertNodeAtCursor(span.firstChild);
    updateValue();
  } else if (item.type === "attrOption") {
    span.innerHTML = xmlToHtml('<attrOption value=""/>');
    insertNodeAtCursor(span.firstChild);
    updateValue();
  } else if (item.type === "function") {
    span.innerHTML = xmlToHtml('<function name=""/>');
    insertNodeAtCursor(span.firstChild);
    updateValue();
  } else if (item.type === "operator") {
    span.innerHTML = xmlToHtml('<operator value=""/>');
    insertNodeAtCursor(span.firstChild);
    updateValue();
  } else if (item.type === "image") {
    imageUploadRef.value.click();
  } else if (item.type === "video") {
    videoUploadRef.value.click();
  }
}

function insertNodeAtCursor(node) {
  const sel = window.getSelection();
  if (sel.rangeCount && editorRef.value) {
    const range = sel.getRangeAt(0);

    // Make sure we are inside the editor
    if (!editorRef.value.contains(range.startContainer)) return;

    range.deleteContents();

    // Insert spacing text node
    const spaceNode = document.createTextNode("\u200B");
    range.insertNode(spaceNode);
    range.insertNode(node);

    range.setStartAfter(spaceNode);
    range.setEndAfter(spaceNode);
    sel.removeAllRanges();
    sel.addRange(range);

    editorRef.value.focus();
  }
}

// File uploads
function readAsDataURL(file, cb) {
  const reader = new FileReader();
  reader.onload = (e) => cb(e.target.result);
  reader.readAsDataURL(file);
}

function onImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  readAsDataURL(file, (dataUrl) => {
    const span = document.createElement("span");
    span.innerHTML = xmlToHtml(`<image src="${dataUrl}" name="${file.name}"/>`);
    insertNodeAtCursor(span.firstChild);
    updateValue();
    e.target.value = "";
  });
}

function onVideoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  readAsDataURL(file, (dataUrl) => {
    const span = document.createElement("span");
    span.innerHTML = xmlToHtml(`<video src="${dataUrl}" name="${file.name}"/>`);
    insertNodeAtCursor(span.firstChild);
    updateValue();
    e.target.value = "";
  });
}

const hideMenuOnClickOutside = (e) => {
  if (!e.target.closest(".slash-menu") && showMenu.value) {
    showMenu.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", hideMenuOnClickOutside);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", hideMenuOnClickOutside);
});
</script>

<style scoped>
.btu-editor-wrapper {
  position: relative;
  width: 100%;
}
.btu-editor-content {
  min-height: 80px;
  border: 1px solid #c8d8e8;
  border-radius: 8px;
  padding: 10px 14px;
  background: #fff;
  color: #1e3a5c;
  font-size: 14px;
  line-height: 1.6;
  outline: none;
  transition: all 0.2s;
  white-space: pre-wrap;
  word-break: break-all;
}
.btu-editor-content:focus {
  border-color: #6aadee;
  box-shadow: 0 0 0 3px rgba(106, 173, 238, 0.12);
}
.btu-editor-content:empty:before {
  content: attr(placeholder);
  color: #a0b2c6;
  pointer-events: none;
}

/* Slash Menu */
.slash-menu {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  list-style: none;
  margin: 0;
  padding: 8px;
  width: 260px;
  border: 1px solid #eee;
  transform: translateY(20px);
}
.slash-menu li {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.slash-menu li.active,
.slash-menu li:hover {
  background: #f0f5fb;
}
.menu-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #e4eff8;
  margin-right: 12px;
  font-size: 16px;
  color: #2a6cb3;
}
.menu-text {
  flex: 1;
}
.menu-title {
  font-size: 13px;
  font-weight: 600;
  color: #1e3a5c;
}
.menu-sub {
  font-size: 11px;
  color: #8aa0b8;
  margin-top: 2px;
  line-height: 1.2;
}

/* Widgets Base */
:deep(.widget) {
  display: inline-flex;
  align-items: center;
  margin: 0 4px;
  vertical-align: middle;
  background: #f6f9fc;
  border: 1px solid #cfdce8;
  border-radius: 6px;
  padding: 2px 6px;
  user-select: none;
}
:deep(.widget input),
:deep(.widget select) {
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  font-family: inherit;
  color: #2a6cb3;
  font-weight: 600;
  padding: 0;
}
:deep(.widget input::placeholder) {
  color: #a0b2c6;
  font-weight: normal;
}

/* widget types */
:deep(.widget-input) {
  background: #eef5fc;
  border-color: #b5cde5;
}
:deep(.val-input) {
  width: 40px;
  text-align: right;
  margin-right: 4px;
}
:deep(.unit-input) {
  width: 40px;
  color: #6a89a8 !important;
  font-weight: 400 !important;
}

:deep(.widget-select) select {
  cursor: pointer;
  appearance: none;
  padding-right: 16px;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6"><path fill="%232a6cb3" d="M0 0h10L5 6z"/></svg>')
    no-repeat right center;
  background-size: 8px 5px;
}

:deep(.widget-function) {
  background: #fff4e5;
  border-color: #ffd6a5;
  color: #d97706;
}
:deep(.fn-input) {
  width: 60px;
  color: #d97706 !important;
  margin-left: 2px;
}

:deep(.widget-operator) {
  border-radius: 50%;
  width: 24px;
  height: 24px;
  padding: 0;
  justify-content: center;
  background: #e5f4ef;
  border-color: #a5dfca;
}
:deep(.op-input) {
  width: 14px;
  height: 14px;
  text-align: center;
  color: #059669 !important;
}

:deep(.widget-image) {
  padding: 4px;
  border-radius: 8px;
}
:deep(.widget-image img) {
  height: 32px;
  border-radius: 4px;
}

:deep(.widget-video) {
  background: #f0ebf8;
  border-color: #d1bdf0;
  padding: 4px 8px;
  gap: 6px;
}
:deep(.widget-video video) {
  height: 24px;
  border-radius: 4px;
  display: none; /* Just show the name */
}
:deep(.widget-video .media-name) {
  font-size: 13px;
  color: #6b21a8;
  font-weight: 500;
}
</style>
