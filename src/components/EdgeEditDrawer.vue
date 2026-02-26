<template>
  <Teleport to="body">
    <transition name="drawer-fade">
      <div v-if="visible" class="drawer-mask" @click.self="$emit('close')">
        <transition name="drawer-slide">
          <div v-if="visible" class="drawer-panel">
            <!-- Header -->
            <header class="drawer-header">
              <div class="header-info">
                <div class="header-icon">🔗</div>
                <div>
                  <h3 class="header-title">连线配置</h3>
                  <p class="header-sub">
                    {{ local.source }} → {{ local.target }} · ID:
                    {{ local.id }}
                  </p>
                </div>
              </div>
              <button class="close-btn" @click="$emit('close')">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </header>

            <!-- Tabs -->
            <nav class="tab-bar">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                :class="['tab-item', { active: activeTab === tab.key }]"
                @click="activeTab = tab.key"
              >
                <span class="tab-icon">{{ tab.icon }}</span>
                <span class="tab-label">{{ tab.label }}</span>
              </button>
            </nav>

            <!-- Body -->
            <div class="drawer-body">
              <!-- 基础信息 -->
              <section v-if="activeTab === 'basic'" class="tab-panel">
                <div class="field-grid">
                  <div class="field">
                    <label>天数</label>
                    <input
                      v-model="local.daysText"
                      placeholder="如: 0天、3-5天"
                    />
                  </div>
                  <div class="field">
                    <label>线型</label>
                    <select v-model="local.lineType">
                      <option value="fixed">fixed(实线)</option>
                      <option value="dynamic">dynamic(虚线)</option>
                    </select>
                  </div>
                </div>
                <div class="field-grid">
                  <div class="field readonly-field">
                    <label>连线 ID</label>
                    <input :value="local.id" disabled />
                  </div>
                  <div class="field readonly-field">
                    <label>源节点</label>
                    <input :value="local.source" disabled />
                  </div>
                  <div class="field readonly-field">
                    <label>目标节点</label>
                    <input :value="local.target" disabled />
                  </div>
                </div>
              </section>

              <!-- 时间窗口 -->
              <section v-if="activeTab === 'timeWindow'" class="tab-panel">
                <div v-if="!timeWindows.length" class="empty-state">
                  <span class="empty-icon">🕐</span>
                  <p>暂无时间窗口配置</p>
                </div>
                <div
                  v-for="(tw, idx) in timeWindows"
                  :key="idx"
                  class="config-card"
                >
                  <div class="card-top">
                    <div class="tag-group">
                      <span class="tag tag-blue">{{
                        tw.seasonFactorValue
                      }}</span>
                      <span class="tag tag-green">{{
                        twTypeLabel(tw.timeWindowType)
                      }}</span>
                    </div>
                    <button
                      class="icon-btn danger"
                      @click="timeWindows.splice(idx, 1)"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>
                  <div class="field-grid cols-2">
                    <div class="field">
                      <label>最小值</label>
                      <input v-model.number="tw.minValue" type="number" />
                    </div>
                    <div class="field">
                      <label>最大值</label>
                      <input v-model.number="tw.maxValue" type="number" />
                    </div>
                    <div class="field">
                      <label>季节因子编码</label>
                      <input v-model="tw.seasonFactorCode" />
                    </div>
                    <div class="field">
                      <label>季节因子值</label>
                      <input v-model="tw.seasonFactorValue" />
                    </div>
                    <div class="field">
                      <label>时间窗口类型</label>
                      <select v-model="tw.timeWindowType">
                        <option value="advanceReminder">提前提醒</option>
                        <option value="executionTimeout">执行超时</option>
                        <option value="delayedExecution">延后执行</option>
                      </select>
                    </div>
                    <div class="field">
                      <label>单位 ID</label>
                      <input v-model.number="tw.unitId" type="number" />
                    </div>
                  </div>
                </div>
                <button class="add-btn" @click="addTimeWindow">
                  <span>＋</span> 新增时间窗口
                </button>
              </section>
            </div>

            <!-- Footer -->
            <footer class="drawer-footer">
              <button class="btn-secondary" @click="$emit('close')">
                取消
              </button>
              <button class="btn-primary" @click="onSave">保存</button>
            </footer>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from "vue";
import { generateSmartId, SmartIdTypeEnum } from "../api/index.js";

const props = defineProps({
  visible: Boolean,
  edgeData: Object,
});

const emit = defineEmits(["close", "save"]);

const tabs = [
  { key: "basic", label: "基础信息", icon: "📄" },
  { key: "timeWindow", label: "时间窗口", icon: "🕐" },
];
const activeTab = ref("basic");

const local = ref({});
const timeWindows = ref([]);

watch(
  () => props.edgeData,
  (raw) => {
    if (!raw) return;
    activeTab.value = "basic";
    local.value = {
      id: raw.id || "",
      source: raw.source || raw.fromBtuTemplateName || "",
      target: raw.target || raw.toBtuTemplateName || "",
      lineType: raw.lineType || raw.properties?.lineType || "fixed",
      daysText: raw.daysText || "",
    };
    const twList =
      raw.properties?.timeWindowParameterPOList ||
      raw.timeWindowParameterPOList ||
      [];
    timeWindows.value = JSON.parse(JSON.stringify(twList));
  },
  { immediate: true }
);

function twTypeLabel(t) {
  return (
    {
      advanceReminder: "提前提醒",
      executionTimeout: "执行超时",
      delayedExecution: "延后执行",
    }[t] || t
  );
}

async function addTimeWindow() {
  const id = await generateSmartId(SmartIdTypeEnum.TIME_WINDOW_PARAMETER);
  timeWindows.value.push({
    timeWindowParameterCode: id,
    attachHostType: "dependency",
    seasonFactorCode: "cropSeason",
    seasonFactorValue: "中稻",
    timeWindowType: "advanceReminder",
    minValue: 0,
    maxValue: 0,
    unitId: 17,
    relatedBizCode: local.value.id,
    version: 1,
  });
}

function onSave() {
  emit("save", {
    id: local.value.id,
    source: local.value.source,
    target: local.value.target,
    lineType: local.value.lineType,
    daysText: local.value.daysText,
    timeWindowParameterPOList: JSON.parse(JSON.stringify(timeWindows.value)),
  });
}
</script>

<style scoped>
/* ========== Mask & Panel ========== */
.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(120, 155, 195, 0.18);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: flex-end;
}
.drawer-panel {
  width: 540px;
  max-width: 94vw;
  height: 100vh;
  background: #f4f8fc;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(100, 140, 190, 0.15);
}

/* ========== Header ========== */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: linear-gradient(135deg, #e4f0e8 0%, #dbe8f6 100%);
  border-bottom: 1px solid #c4dac8;
}
.header-info {
  display: flex;
  align-items: center;
  gap: 14px;
}
.header-icon {
  width: 40px;
  height: 40px;
  background: #fff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  box-shadow: 0 2px 8px rgba(100, 150, 200, 0.12);
}
.header-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1e5c3a;
}
.header-sub {
  margin: 3px 0 0;
  font-size: 12px;
  color: #6a89a8;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #5a7a99;
  cursor: pointer;
  transition: all 0.2s;
}
.close-btn:hover {
  background: rgba(100, 150, 200, 0.15);
  color: #1e3a5c;
}

/* ========== Tabs ========== */
.tab-bar {
  display: flex;
  gap: 2px;
  padding: 0 20px;
  background: #edf3f9;
  border-bottom: 1px solid #d8e4ef;
  overflow-x: auto;
}
.tab-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 12px 14px;
  border: none;
  background: none;
  font-size: 13px;
  font-weight: 500;
  color: #6a89a8;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: all 0.2s;
}
.tab-item:hover {
  color: #2a6cb3;
  background: rgba(200, 220, 245, 0.3);
}
.tab-item.active {
  color: #1a5296;
  border-bottom-color: #4a9be8;
  background: #f4f8fc;
  font-weight: 600;
}
.tab-icon {
  font-size: 14px;
}

/* ========== Body ========== */
.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}
.tab-panel {
  animation: panelIn 0.2s ease;
}
@keyframes panelIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* ========== Fields ========== */
.field {
  margin-bottom: 14px;
}
.field label {
  display: block;
  margin-bottom: 5px;
  font-size: 12px;
  font-weight: 600;
  color: #4a6b8a;
  letter-spacing: 0.02em;
}
.field input,
.field select,
.field textarea {
  width: 100%;
  border: 1px solid #c8d8e8;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 13px;
  background: #fff;
  color: #1e3a5c;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: #6aadee;
  box-shadow: 0 0 0 3px rgba(106, 173, 238, 0.12);
}
.field input:disabled {
  background: #edf2f7;
  color: #8aa0b8;
  cursor: not-allowed;
}
.readonly-field {
  opacity: 0.7;
}

.field-grid {
  display: grid;
  gap: 12px;
}
.field-grid .field {
  margin-bottom: 0;
}
.field-grid:not(.cols-2):not(.cols-3) {
  grid-template-columns: 1fr 1fr;
}
.field-grid.cols-2 {
  grid-template-columns: 1fr 1fr;
}
.field-grid.cols-3 {
  grid-template-columns: 1fr 1fr 1fr;
}

/* ========== Cards ========== */
.config-card {
  background: #fff;
  border: 1px solid #dae5f0;
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 14px;
  transition: box-shadow 0.2s;
}
.config-card:hover {
  box-shadow: 0 3px 14px rgba(100, 150, 200, 0.1);
}
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

/* ========== Tags ========== */
.tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.tag-group {
  display: flex;
  gap: 6px;
  align-items: center;
}
.tag-blue {
  background: #e6f0fb;
  color: #2a6cb3;
}
.tag-green {
  background: #e2f5ee;
  color: #1e8a5c;
}

/* ========== Empty ========== */
.empty-state {
  text-align: center;
  padding: 40px 0;
  color: #8aa0b8;
}
.empty-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 8px;
}
.empty-state p {
  margin: 0;
  font-size: 13px;
}

/* ========== Buttons ========== */
.icon-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  color: #8a9fb8;
  transition: all 0.2s;
}
.icon-btn.danger:hover {
  background: #fde8e8;
  color: #d04040;
}

.add-btn {
  width: 100%;
  padding: 12px;
  border: 2px dashed #c8d8e8;
  border-radius: 10px;
  background: transparent;
  color: #4a8ac8;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  transition: all 0.2s;
}
.add-btn:hover {
  background: #e8f2fc;
  border-color: #6aadee;
  color: #2a6cb3;
}

/* ========== Footer ========== */
.drawer-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid #d8e4ef;
  background: #f9fbfd;
}
.btn-secondary {
  padding: 9px 22px;
  border: 1px solid #c8d8e8;
  border-radius: 8px;
  background: #fff;
  color: #4a6b8a;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover {
  background: #edf3fa;
  border-color: #92b8de;
}
.btn-primary {
  padding: 9px 26px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #3d8be8 0%, #2a6cb3 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(42, 108, 179, 0.2);
  transition: all 0.2s;
}
.btn-primary:hover {
  background: linear-gradient(135deg, #4a9be8 0%, #3d7cc5 100%);
  box-shadow: 0 4px 14px rgba(42, 108, 179, 0.3);
  transform: translateY(-1px);
}

/* ========== Transitions ========== */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.25s ease;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}
.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
