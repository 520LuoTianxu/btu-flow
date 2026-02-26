<template>
  <Teleport to="body">
    <transition name="drawer-fade">
      <div v-if="visible" class="drawer-mask" @click.self="$emit('close')">
        <transition name="drawer-slide">
          <div v-if="visible" class="drawer-panel">
            <!-- Header -->
            <header class="drawer-header">
              <div class="header-info">
                <div class="header-icon">⚙</div>
                <div>
                  <h3 class="header-title">
                    {{ local.properties?.name || "节点配置" }}
                  </h3>
                  <p class="header-sub">
                    ID: {{ local.id }} · {{ local.growthStageCode }}
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
                    <label>节点名称</label>
                    <input
                      v-model="local.properties.name"
                      placeholder="请输入名称"
                    />
                  </div>
                  <div class="field">
                    <label>生育阶段编码</label>
                    <input
                      v-model="local.growthStageCode"
                      placeholder="growthStageCode"
                    />
                  </div>
                  <div class="field">
                    <label>作业类型编码</label>
                    <input
                      v-model="local.properties.operationTypeCode"
                      placeholder="operationTypeCode"
                    />
                  </div>
                  <div class="field">
                    <label>线型</label>
                    <select v-model="local.properties.lineType">
                      <option value="fixed">fixed(实线)</option>
                      <option value="dynamic">dynamic(虚线)</option>
                    </select>
                  </div>
                </div>
                <div class="field readonly-field">
                  <label>节点 ID</label>
                  <input :value="local.id" disabled />
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

              <!-- BTU主题信息 -->
              <section v-if="activeTab === 'subject'" class="tab-panel">
                <div v-if="!subjects.length" class="empty-state">
                  <span class="empty-icon">📋</span>
                  <p>暂无主题信息</p>
                </div>
                <div
                  v-for="(subj, si) in subjects"
                  :key="si"
                  class="config-card"
                >
                  <div class="card-top">
                    <span class="tag tag-blue">主题 {{ si + 1 }}</span>
                    <button
                      class="icon-btn danger"
                      @click="subjects.splice(si, 1)"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>
                  <div class="field">
                    <label>主题标题</label>
                    <input v-model="subj.btuTemplateSubjectPO.termTitle" />
                  </div>
                  <!-- 条目列表 -->
                  <div
                    v-for="(term, ti) in subj.btuTemplateTermAGOList || []"
                    :key="ti"
                    class="term-card"
                  >
                    <div class="card-top">
                      <span class="term-num">条目 {{ ti + 1 }}</span>
                      <button
                        class="icon-btn danger sm"
                        @click="subj.btuTemplateTermAGOList.splice(ti, 1)"
                      >
                        ✕
                      </button>
                    </div>
                    <div class="field">
                      <label>条目内容</label>
                      <textarea
                        v-model="term.btuTemplateTermPO.termContent"
                        rows="3"
                      ></textarea>
                    </div>
                    <div class="field-grid cols-2">
                      <div class="field">
                        <label>条件类型</label>
                        <select v-model="term.btuTemplateTermPO.conditionType">
                          <option value="none">无条件</option>
                          <option value="mutuallyExclusive">互斥</option>
                        </select>
                      </div>
                      <div
                        class="field"
                        v-if="term.btuTemplateTermPO.conditionType !== 'none'"
                      >
                        <label>条件表达式</label>
                        <input
                          v-model="term.btuTemplateTermPO.conditionExpression"
                        />
                      </div>
                    </div>
                    <div
                      class="field"
                      v-if="term.btuTemplateTermPO.conditionType !== 'none'"
                    >
                      <label>条件描述</label>
                      <input
                        v-model="term.btuTemplateTermPO.conditionExpressionDesc"
                      />
                    </div>
                  </div>
                  <button class="add-btn sm" @click="addTerm(subj)">
                    <span>＋</span> 新增条目
                  </button>
                </div>
                <button class="add-btn" @click="addSubject">
                  <span>＋</span> 新增主题
                </button>
              </section>

              <!-- 准入条件 -->
              <section v-if="activeTab === 'admittance'" class="tab-panel">
                <template v-if="admittance">
                  <div class="config-card">
                    <div class="field">
                      <label>表达式</label>
                      <input v-model="admittance.expression" />
                    </div>
                    <div class="field">
                      <label>表达式描述</label>
                      <input v-model="admittance.expressionDesc" />
                    </div>
                    <div class="field-grid cols-2">
                      <div class="field">
                        <label>调度间隔值</label>
                        <input
                          v-model.number="admittance.scheduleIntervalValue"
                          type="number"
                        />
                      </div>
                      <div class="field">
                        <label>调度间隔单位</label>
                        <input
                          v-model.number="admittance.scheduleIntervalUnit"
                          type="number"
                        />
                      </div>
                    </div>
                  </div>
                </template>
                <div v-else class="empty-state">
                  <span class="empty-icon">🔒</span>
                  <p>暂无准入条件配置</p>
                </div>
                <button
                  v-if="!admittance"
                  class="add-btn"
                  @click="addAdmittance"
                >
                  <span>＋</span> 新增准入条件
                </button>
              </section>

              <!-- 纠偏信息 -->
              <section v-if="activeTab === 'correction'" class="tab-panel">
                <div v-if="!corrections.length" class="empty-state">
                  <span class="empty-icon">🔧</span>
                  <p>暂无纠偏信息</p>
                </div>
                <div
                  v-for="(corr, ci) in corrections"
                  :key="ci"
                  class="config-card"
                >
                  <div class="card-top">
                    <span class="tag tag-orange">纠偏 {{ ci + 1 }}</span>
                    <button
                      class="icon-btn danger"
                      @click="corrections.splice(ci, 1)"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>
                  <div class="field">
                    <label>条件表达式</label>
                    <textarea
                      v-model="corr.btuTemplateCorrectionPO.conditionExpression"
                      rows="2"
                    ></textarea>
                  </div>
                  <div class="field">
                    <label>条件描述</label>
                    <textarea
                      v-model="
                        corr.btuTemplateCorrectionPO.conditionExpressionDesc
                      "
                      rows="2"
                    ></textarea>
                  </div>
                  <div class="field-grid cols-3">
                    <div class="field">
                      <label>调度间隔值</label>
                      <input
                        v-model.number="
                          corr.btuTemplateCorrectionPO.scheduleIntervalValue
                        "
                        type="number"
                      />
                    </div>
                    <div class="field">
                      <label>调度间隔单位</label>
                      <input
                        v-model.number="
                          corr.btuTemplateCorrectionPO.scheduleIntervalUnit
                        "
                        type="number"
                      />
                    </div>
                    <div class="field">
                      <label>最大执行次数</label>
                      <input
                        v-model.number="
                          corr.btuTemplateCorrectionPO.maxExecutionTimes
                        "
                        type="number"
                        placeholder="不限"
                      />
                    </div>
                  </div>
                  <!-- Impacts -->
                  <div
                    v-if="corr.btuTemplateImpactPOList?.length"
                    class="impacts-box"
                  >
                    <p class="impacts-title">影响列表</p>
                    <div
                      v-for="(imp, ii) in corr.btuTemplateImpactPOList"
                      :key="ii"
                      class="impact-item"
                    >
                      <span class="tag tag-blue">{{ imp.impactType }}</span>
                      <span class="tag tag-green">{{ imp.impactTarget }}</span>
                      <span class="impact-code">{{ imp.relatedBizCode }}</span>
                    </div>
                  </div>
                </div>
                <button class="add-btn" @click="addCorrection">
                  <span>＋</span> 新增纠偏
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
  nodeData: Object,
});

const emit = defineEmits(["close", "save"]);

const tabs = [
  { key: "basic", label: "基础信息", icon: "📄" },
  { key: "timeWindow", label: "时间窗口", icon: "🕐" },
  { key: "subject", label: "BTU主题", icon: "📋" },
  { key: "admittance", label: "准入条件", icon: "🔒" },
  { key: "correction", label: "纠偏信息", icon: "🔧" },
];
const activeTab = ref("basic");

const local = ref({});
const timeWindows = ref([]);
const subjects = ref([]);
const admittance = ref(null);
const corrections = ref([]);

watch(
  () => props.nodeData,
  (raw) => {
    if (!raw) return;
    activeTab.value = "basic";
    local.value = JSON.parse(
      JSON.stringify({
        id: raw.id,
        type: raw.type,
        growthStageCode: raw.growthStageCode || "",
        properties: {
          name: raw.properties?.name || "",
          lineType: raw.properties?.lineType || "fixed",
          operationTypeCode: raw.properties?.operationTypeCode || "",
        },
      })
    );
    timeWindows.value = JSON.parse(
      JSON.stringify(raw.timeWindowParameterPOList || [])
    );
    const cfg = raw.properties?.btuConfig || {};
    subjects.value = JSON.parse(
      JSON.stringify(cfg.btuTemplateSubjectAGOList || [])
    );
    const admRaw =
      cfg.btuTemplateAdmittanceConditionAGO?.btuTemplateAdmittanceConditionPO;
    admittance.value = admRaw ? JSON.parse(JSON.stringify(admRaw)) : null;
    corrections.value = JSON.parse(JSON.stringify(cfg.corrections || []));
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
    attachHostType: "btu",
    seasonFactorCode: "cropSeason",
    seasonFactorValue: "中稻",
    timeWindowType: "advanceReminder",
    minValue: 1,
    maxValue: 1,
    unitId: 17,
    relatedBizCode: local.value.id,
    version: 1,
  });
}

async function addSubject() {
  const id = await generateSmartId(SmartIdTypeEnum.BTU_TEMPLATE_SUBJECT);
  subjects.value.push({
    operationType: "CREATE",
    btuTemplateSubjectPO: {
      btuTemplateSubjectCode: id,
      btuTemplateCode: local.value.id,
      termTitle: "新主题",
      version: 1,
    },
    btuTemplateTermAGOList: [],
  });
}

async function addTerm(subj) {
  if (!subj.btuTemplateTermAGOList) subj.btuTemplateTermAGOList = [];
  const id = await generateSmartId(SmartIdTypeEnum.BTU_TEMPLATE_TERM);
  subj.btuTemplateTermAGOList.push({
    operationType: "CREATE",
    btuTemplateTermPO: {
      btuTemplateTermCode: id,
      expressionType: "termSelect",
      conditionExpression: null,
      conditionExpressionDesc: null,
      conditionType: "none",
      termContent: "",
      termAttributes: null,
      tagTermContent: "",
      btuTemplateSubjectCode: subj.btuTemplateSubjectPO?.btuTemplateSubjectCode,
      version: 1,
    },
    btuTemplateTermContentPOList: [],
    agricInputsTemplateAGOList: [],
  });
}

async function addCorrection() {
  const id = await generateSmartId(SmartIdTypeEnum.BTU_TEMPLATE_CORRECTION);
  corrections.value.push({
    operationType: "CREATE",
    btuTemplateCorrectionPO: {
      btuTemplateCorrectionCode: id,
      expressionType: "correction",
      conditionExpression: "",
      conditionExpressionDesc: "",
      tagConditionExpressionDesc: "",
      btuTemplateCode: local.value.id,
      version: 1,
      scheduleIntervalValue: 6,
      scheduleIntervalUnit: 14,
      maxExecutionTimes: null,
    },
    btuTemplateImpactPOList: [],
    btuTemplateImpactAGOList: null,
  });
}

async function addAdmittance() {
  const id = await generateSmartId(
    SmartIdTypeEnum.BTU_TEMPLATE_ADMITTANCE_CONDITION
  );
  admittance.value = {
    btuTemplateAdmittanceConditionCode: id,
    btuTemplateCode: local.value.id,
    expressionType: "admittance",
    expression: "",
    expressionDesc: "",
    tagExpressionDesc: "",
    scheduleIntervalValue: 1,
    scheduleIntervalUnit: 14,
    version: 1,
  };
}

function onSave() {
  const result = JSON.parse(JSON.stringify(local.value));
  result.timeWindowParameterPOList = JSON.parse(
    JSON.stringify(timeWindows.value)
  );
  if (!result.properties) result.properties = {};
  result.properties.btuConfig = {
    btuTemplateAdmittanceConditionAGO: admittance.value
      ? {
          operationType: "UNCHANGED",
          btuTemplateAdmittanceConditionPO: JSON.parse(
            JSON.stringify(admittance.value)
          ),
        }
      : null,
    btuTemplateSubjectAGOList: JSON.parse(JSON.stringify(subjects.value)),
    corrections: JSON.parse(JSON.stringify(corrections.value)),
  };
  emit("save", result);
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
  width: 580px;
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
  background: linear-gradient(135deg, #e8f1fa 0%, #dbe8f6 100%);
  border-bottom: 1px solid #cddaea;
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
  color: #1e3a5c;
}
.header-sub {
  margin: 3px 0 0;
  font-size: 12px;
  color: #6a89a8;
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
}
.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: #6aadee;
  box-shadow: 0 0 0 3px rgba(106, 173, 238, 0.12);
}
.field textarea {
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
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

.term-card {
  background: #f0f5fb;
  border: 1px solid #dbe6f2;
  border-radius: 10px;
  padding: 14px;
  margin: 10px 0;
}
.term-num {
  font-size: 12px;
  font-weight: 600;
  color: #4a7aaa;
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
.tag-orange {
  background: #fef0e4;
  color: #b86a1e;
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
.icon-btn.sm {
  width: 22px;
  height: 22px;
  font-size: 10px;
}

.add-btn {
  width: 100%;
  padding: 11px;
  border: 1.5px dashed #b8cfea;
  border-radius: 10px;
  background: transparent;
  color: #4a8bd4;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}
.add-btn:hover {
  background: #edf4fc;
  border-color: #6aadee;
}
.add-btn.sm {
  padding: 8px;
  font-size: 12px;
  margin-top: 8px;
}

/* ========== Impacts ========== */
.impacts-box {
  border-top: 1px solid #e8eff6;
  padding-top: 12px;
  margin-top: 12px;
}
.impacts-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: #4a6b8a;
}
.impact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.impact-code {
  font-size: 12px;
  color: #8aa0b8;
  font-family: monospace;
}

/* ========== Empty ========== */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #8aa0b8;
}
.empty-icon {
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
  opacity: 0.6;
}
.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* ========== Footer ========== */
.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid #d8e4ef;
  background: #f4f8fc;
}
.btn-secondary {
  padding: 9px 22px;
  border: 1px solid #c0d0e0;
  border-radius: 8px;
  background: #fff;
  color: #4a6b8a;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover {
  background: #edf3f9;
}
.btn-primary {
  padding: 9px 28px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #4a9be8, #3a80cc);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(74, 155, 232, 0.25);
  transition: all 0.2s;
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(74, 155, 232, 0.35);
}

/* ========== Transitions ========== */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.25s;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}
.drawer-slide-enter-active {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.drawer-slide-leave-active {
  transition: transform 0.2s ease-in;
}
.drawer-slide-enter-from {
  transform: translateX(100%);
}
.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
