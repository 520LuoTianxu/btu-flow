<template>
  <header class="toolbar">
    <div class="left-actions">
      <label class="file-btn">
        上传 JSON
        <input
          type="file"
          accept="application/json,.json"
          @change="onFileUpload"
        />
      </label>
      <button @click="onGenerate">一键生成</button>
      <button @click="onSort" :disabled="flowNodes.length === 0">
        一键排序
      </button>
      <button @click="$emit('fit-view')" :disabled="flowNodes.length === 0">
        适配视图
      </button>
      <button @click="exportAll" :disabled="flowNodes.length === 0">
        导出 flowConfig + flowLayout
      </button>
    </div>
    <span class="tips"
      >点击节点可编辑全部配置数据；双击边可编辑天数；导出后保存为 flowConfig 与
      flowLayout</span
    >
  </header>
</template>

<script setup>
import { flowNodes, jsonInput } from "../store/flowStore.js";
import {
  generateFromInput,
  sortLayout,
  exportAll,
} from "../store/flowActions.js";

const emit = defineEmits(["fit-view"]);

async function onFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  jsonInput.value = text;
  await generateFromInput();
  emit("fit-view");
  event.target.value = "";
}

async function onGenerate() {
  await generateFromInput();
  emit("fit-view");
}

async function onSort() {
  await sortLayout();
  emit("fit-view");
}
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.left-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
button,
.file-btn {
  border: 1px solid #6c7a8f;
  background: #f7fbff;
  color: #102333;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 14px;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.file-btn input {
  display: none;
}
.tips {
  font-size: 13px;
  color: #4f6074;
}
</style>
