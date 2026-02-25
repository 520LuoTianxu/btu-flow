<template>
  <section class="io-panel">
    <textarea
      v-model="jsonInput"
      placeholder="粘贴 flowConfig JSON，或上传文件后自动填充"
    />
    <textarea
      v-model="exportText"
      readonly
      placeholder="导出的 flowConfig + flowLayout JSON 会显示在这里"
    />
  </section>
</template>

<script setup>
import { jsonInput, exportText } from "../store/flowStore.js";
</script>

<style scoped>
.io-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.io-panel textarea {
  width: 100%;
  min-height: 150px;
  resize: vertical;
  border: 1px solid #bbcad8;
  border-radius: 10px;
  padding: 10px;
  background: #ffffffdb;
  font-size: 13px;
}

@media (max-width: 980px) {
  .io-panel {
    grid-template-columns: 1fr;
  }
}
</style>
