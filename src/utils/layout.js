import { MarkerType } from "@vue-flow/core";
import dagre from "@dagrejs/dagre";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 88;
const GROUP_PAD = 36;
const GROUP_LABEL_H = 36;

export function parseEdgeDays(edgeRaw) {
    const list =
        edgeRaw?.properties?.timeWindowParameterPOList ||
        edgeRaw?.timeWindowParameterPOList;
    if (!Array.isArray(list) || list.length === 0) return "0天";
    const first = list[0] || {};
    const min = Number(first.minValue);
    const max = Number(first.maxValue);
    if (Number.isFinite(min) && Number.isFinite(max)) {
        return min === max ? `${min}天` : `${min}-${max}天`;
    }
    return "0天";
}

export function nodeStyle(lineType, options = {}) {
    const isDisconnected = Boolean(options.disconnected);
    const isIsolated = Boolean(options.isolated);
    const borderColor = isDisconnected
        ? "#d97706"
        : isIsolated
          ? "#7c8aa5"
          : "#3d5f86";
    const background = isDisconnected
        ? "#fff7ed"
        : isIsolated
          ? "#f8fafc"
          : "#fff";
    const boxShadow = isDisconnected
        ? "0 5px 14px rgba(217, 119, 6, 0.14)"
        : isIsolated
          ? "0 5px 12px rgba(100, 116, 139, 0.12)"
          : "0 5px 12px #d9e4ef";

    return {
        width: `${NODE_WIDTH}px`,
        minHeight: `${NODE_HEIGHT}px`,
        borderRadius: "10px",
        border: `2px solid ${borderColor}`,
        borderStyle: lineType === "dynamic" ? "dashed" : "solid",
        background,
        boxShadow,
        padding: "10px 12px",
    };
}

export function edgeStyle(lineType) {
    return {
        stroke: "#38557a",
        strokeWidth: 2,
        strokeDasharray: lineType === "dynamic" ? "8 5" : "0",
    };
}

function asPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeName(value, fallback) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
    return fallback;
}

function collectLookupKeys(rawNode, nodeName) {
    const keys = [
        rawNode?.id,
        rawNode?.btuTemplateCode,
        rawNode?.properties?.btuTemplateCode,
        rawNode?.properties?.name,
        rawNode?.name,
        nodeName,
    ];
    return [...new Set(keys.map((value) => normalizeName(value, "")).filter(Boolean))];
}

function buildImportedPositionsMap(flowLayout, resolveNodeName) {
    const positions = Array.isArray(flowLayout?.positions) ? flowLayout.positions : [];
    if (positions.length === 0) return null;

    const map = new Map();
    positions.forEach((item) => {
        const x = Number(item?.x);
        const y = Number(item?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        const name = resolveNodeName(
            item?.name || item?.nodeName || item?.label,
            item?.id || item?.nodeId || item?.btuTemplateCode
        );
        if (!name) return;

        map.set(name, { x, y });
    });

    return map.size > 0 ? map : null;
}

export function safeParse(inputText) {
    const parsed = JSON.parse(inputText);
    const payload = parsed?.flowConfig
        ? parsed
        : parsed?.data?.flowConfig
          ? {
                flowConfig: parsed.data.flowConfig,
                flowLayout: parsed.data.flowLayout ?? parsed.flowLayout,
            }
          : parsed;
    const flowConfig = payload?.flowConfig ?? payload;
    const rawNodeList = Array.isArray(flowConfig?.nodes) ? flowConfig.nodes : [];
    const rawEdgeList = Array.isArray(flowConfig?.edges) ? flowConfig.edges : [];

    const nodeNameByLookupKey = new Map();
    const nodeList = rawNodeList.map((rawNode, index) => {
        const properties = { ...asPlainObject(rawNode?.properties) };
        const name = normalizeName(
            properties.name || rawNode?.name || rawNode?.label,
            `node_${index + 1}`
        );

        properties.name = name;
        properties.lineType = properties.lineType || rawNode?.lineType || "fixed";

        const normalizedNode = {
            ...rawNode,
            id: normalizeName(rawNode?.id, name),
            properties,
        };

        collectLookupKeys(rawNode, name).forEach((key) => {
            if (!nodeNameByLookupKey.has(key)) {
                nodeNameByLookupKey.set(key, name);
            }
        });

        return normalizedNode;
    });

    const resolveNodeName = (rawName, rawCode) => {
        const directName = normalizeName(rawName, "");
        if (directName && nodeNameByLookupKey.has(directName)) {
            return nodeNameByLookupKey.get(directName);
        }
        if (directName) return directName;

        const lookupCode = normalizeName(rawCode, "");
        if (lookupCode && nodeNameByLookupKey.has(lookupCode)) {
            return nodeNameByLookupKey.get(lookupCode);
        }
        return "";
    };

    const edgeList = rawEdgeList.map((rawEdge, index) => {
        const properties = { ...asPlainObject(rawEdge?.properties) };
        const sourceName = resolveNodeName(
            rawEdge?.fromBtuTemplateName || rawEdge?.source || rawEdge?.fromName,
            rawEdge?.fromBtuTemplateCode || rawEdge?.sourceCode || rawEdge?.sourceId
        );
        const targetName = resolveNodeName(
            rawEdge?.toBtuTemplateName || rawEdge?.target || rawEdge?.toName,
            rawEdge?.toBtuTemplateCode || rawEdge?.targetCode || rawEdge?.targetId
        );
        const edgeId = normalizeName(
            rawEdge?.id,
            `e-${sourceName || "unknown"}-${targetName || "unknown"}-${index}`
        );

        return {
            ...rawEdge,
            id: edgeId,
            source: sourceName,
            target: targetName,
            fromBtuTemplateName: sourceName,
            toBtuTemplateName: targetName,
            properties: {
                ...properties,
                lineType: properties.lineType || rawEdge?.lineType || "fixed",
            },
        };
    });

    if (nodeList.length === 0) throw new Error("nodes 为空，无法生成布局");
    return {
        nodeList,
        edgeList,
        flowLayout: {
            positionsMap: buildImportedPositionsMap(payload?.flowLayout, resolveNodeName),
        },
    };
}

function computeAutoAbsolutePositions(byName, normalEdges) {
    const groups = new Map();
    byName.forEach((info, name) => {
        const gc = info.growthStageCode;
        if (!groups.has(gc)) groups.set(gc, []);
        groups.get(gc).push(name);
    });
    const nodeToGroup = new Map();
    byName.forEach((info, name) => nodeToGroup.set(name, info.growthStageCode));

    const groupInternalPositions = new Map();
    const groupSizes = new Map();

    groups.forEach((members, gc) => {
        const g = new dagre.graphlib.Graph();
        g.setGraph({ rankdir: "LR", nodesep: 100, ranksep: 140, edgesep: 60 });
        g.setDefaultEdgeLabel(() => ({}));

        members.forEach((name) => {
            g.setNode(name, { width: NODE_WIDTH, height: NODE_HEIGHT });
        });

        const memberSet = new Set(members);
        normalEdges.forEach((edge) => {
            if (memberSet.has(edge.source) && memberSet.has(edge.target)) {
                g.setEdge(edge.source, edge.target);
            }
        });

        dagre.layout(g);

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        g.nodes().forEach((id) => {
            const node = g.node(id);
            const x = node.x - NODE_WIDTH / 2;
            const y = node.y - NODE_HEIGHT / 2;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + NODE_WIDTH);
            maxY = Math.max(maxY, y + NODE_HEIGHT);
        });

        g.nodes().forEach((id) => {
            const node = g.node(id);
            groupInternalPositions.set(id, {
                x: node.x - NODE_WIDTH / 2 - minX + GROUP_PAD,
                y: node.y - NODE_HEIGHT / 2 - minY + GROUP_PAD + GROUP_LABEL_H,
            });
        });

        groupSizes.set(gc, {
            width: maxX - minX + GROUP_PAD * 2,
            height: maxY - minY + GROUP_PAD * 2 + GROUP_LABEL_H,
        });
    });

    const gg = new dagre.graphlib.Graph();
    gg.setGraph({ rankdir: "TB", nodesep: 120, ranksep: 160, edgesep: 80 });
    gg.setDefaultEdgeLabel(() => ({}));

    groups.forEach((_, gc) => {
        const size = groupSizes.get(gc);
        gg.setNode(gc, { width: size.width, height: size.height });
    });

    const interGroupEdgeSet = new Set();
    normalEdges.forEach((edge) => {
        const sourceGroup = nodeToGroup.get(edge.source);
        const targetGroup = nodeToGroup.get(edge.target);
        if (sourceGroup !== targetGroup) {
            const key = `${sourceGroup}|${targetGroup}`;
            if (!interGroupEdgeSet.has(key)) {
                interGroupEdgeSet.add(key);
                gg.setEdge(sourceGroup, targetGroup);
            }
        }
    });

    dagre.layout(gg);

    const groupPositions = new Map();
    gg.nodes().forEach((gc) => {
        const node = gg.node(gc);
        const size = groupSizes.get(gc);
        groupPositions.set(gc, {
            x: node.x - size.width / 2,
            y: node.y - size.height / 2,
        });
    });

    const absolutePositions = new Map();
    byName.forEach((_, name) => {
        const gc = nodeToGroup.get(name);
        const groupPosition = groupPositions.get(gc);
        const internalPosition = groupInternalPositions.get(name);
        absolutePositions.set(name, {
            x: groupPosition.x + internalPosition.x,
            y: groupPosition.y + internalPosition.y,
        });
    });

    return { absolutePositions, nodeToGroup };
}

function computeGroupBoxes(byName, absolutePositions) {
    const bounds = new Map();

    byName.forEach((info, name) => {
        const position = absolutePositions.get(name);
        if (!position) return;

        const gc = info.growthStageCode;
        if (!bounds.has(gc)) {
            bounds.set(gc, {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity,
            });
        }

        const groupBound = bounds.get(gc);
        groupBound.minX = Math.min(groupBound.minX, position.x - GROUP_PAD);
        groupBound.minY = Math.min(groupBound.minY, position.y - GROUP_PAD - GROUP_LABEL_H);
        groupBound.maxX = Math.max(groupBound.maxX, position.x + NODE_WIDTH + GROUP_PAD);
        groupBound.maxY = Math.max(groupBound.maxY, position.y + NODE_HEIGHT + GROUP_PAD);
    });

    const groupPositions = new Map();
    const groupSizes = new Map();
    bounds.forEach((bound, gc) => {
        groupPositions.set(gc, { x: bound.minX, y: bound.minY });
        groupSizes.set(gc, {
            width: bound.maxX - bound.minX,
            height: bound.maxY - bound.minY,
        });
    });

    return { groupPositions, groupSizes };
}

function analyzeConnectivity(byName, normalizedEdges) {
    const adjacency = new Map();
    byName.forEach((_, name) => adjacency.set(name, new Set()));

    normalizedEdges.forEach((edge) => {
        if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) return;
        adjacency.get(edge.source).add(edge.target);
        adjacency.get(edge.target).add(edge.source);
    });

    const componentIdByName = new Map();
    const componentSizeById = new Map();
    let componentIndex = 0;

    byName.forEach((_, startName) => {
        if (componentIdByName.has(startName)) return;

        componentIndex += 1;
        const queue = [startName];
        const componentNodes = [];
        componentIdByName.set(startName, componentIndex);

        while (queue.length > 0) {
            const current = queue.shift();
            componentNodes.push(current);

            adjacency.get(current).forEach((nextName) => {
                if (componentIdByName.has(nextName)) return;
                componentIdByName.set(nextName, componentIndex);
                queue.push(nextName);
            });
        }

        componentSizeById.set(componentIndex, componentNodes.length);
    });

    const seedNodeNames = [...byName.keys()].filter((name) => name.includes("播种"));
    const connectedToSeed = new Set();
    const queue = [...seedNodeNames];
    queue.forEach((name) => connectedToSeed.add(name));

    while (queue.length > 0) {
        const current = queue.shift();
        adjacency.get(current)?.forEach((nextName) => {
            if (connectedToSeed.has(nextName)) return;
            connectedToSeed.add(nextName);
            queue.push(nextName);
        });
    }

    return {
        adjacency,
        componentIdByName,
        componentSizeById,
        connectedToSeed,
        hasSeedNode: seedNodeNames.length > 0,
    };
}

export function buildLayout(nodeList, edgeList, options = {}) {
    const byName = new Map();
    nodeList.forEach((n, index) => {
        const name = n?.properties?.name || `node_${index}`;
        byName.set(name, {
            name,
            growthStageCode: n.growthStageCode || "OTHER",
            operationTypeCode: n?.properties?.operationTypeCode || "",
            lineType: n?.properties?.lineType || "fixed",
        });
    });

    const normalizedEdges = edgeList
        .filter(
            (e) =>
                byName.has(e.fromBtuTemplateName) && byName.has(e.toBtuTemplateName)
        )
        .map((e, idx) => ({
            id: e.id || `e-${e.fromBtuTemplateName}-${e.toBtuTemplateName}-${idx}`,
            source: e.fromBtuTemplateName,
            target: e.toBtuTemplateName,
            lineType: e?.properties?.lineType || "fixed",
            daysText: parseEdgeDays(e),
        }));

    const selfLoops = normalizedEdges.filter((e) => e.source === e.target);
    const normalEdges = normalizedEdges.filter((e) => e.source !== e.target);
    const connectivity = analyzeConnectivity(byName, normalizedEdges);
    const { absolutePositions: autoAbsolutePositions, nodeToGroup } = computeAutoAbsolutePositions(
        byName,
        normalEdges
    );

    const absolutePositions = new Map();
    byName.forEach((_, name) => {
        absolutePositions.set(
            name,
            options?.positionsMap?.get(name) || autoAbsolutePositions.get(name)
        );
    });

    const { groupPositions, groupSizes } = computeGroupBoxes(byName, absolutePositions);

    const nodes = [];

    groupPositions.forEach((pos, gc) => {
        const sz = groupSizes.get(gc);
        nodes.push({
            id: `__group_${gc}`,
            type: "group-box",
            position: { x: pos.x, y: pos.y },
            draggable: false,
            selectable: false,
            connectable: false,
            focusable: false,
            style: {
                width: `${sz.width}px`,
                height: `${sz.height}px`,
                borderRadius: "14px",
                border: "2px solid #b8d4ef",
                background: "rgba(220, 235, 252, 0.35)",
                padding: "0",
                zIndex: 0,
                pointerEvents: "none",
            },
            data: { label: gc, isGroup: true },
        });
    });

    byName.forEach((info, name) => {
        const pos = absolutePositions.get(name);
        const degree = connectivity.adjacency.get(name)?.size || 0;
        const isIsolated = degree === 0;
        const isDisconnectedFromSeed =
            connectivity.hasSeedNode && !connectivity.connectedToSeed.has(name);
        const componentId = connectivity.componentIdByName.get(name) || 1;
        const componentSize = connectivity.componentSizeById.get(componentId) || 1;
        const statusText = isDisconnectedFromSeed
            ? "未接入播种链"
            : isIsolated
              ? "孤立节点"
              : "";

        nodes.push({
            id: name,
            type: "default",
            position: { x: pos.x, y: pos.y },
            style: nodeStyle(info.lineType, {
                disconnected: isDisconnectedFromSeed,
                isolated: isIsolated,
            }),
            data: {
                name,
                growthStageCode: info.growthStageCode || "-",
                operationTypeCode: info.operationTypeCode || "-",
                lineType: info.lineType,
                isIsolated,
                isDisconnectedFromSeed,
                componentId,
                componentSize,
                statusText,
            },
        });
    });

    // === 6. Edges ===
    const posMap = absolutePositions;

    const gapEdgeCount = new Map();
    const gapEdgeIndex = new Map();

    // Calculate gap spaces for all edges first to assign offsets
    normalEdges.forEach((e) => {
        const srcPos = posMap.get(e.source);
        const tgtPos = posMap.get(e.target);
        if (!srcPos || !tgtPos) return;

        const gS = nodeToGroup.get(e.source);
        const gT = nodeToGroup.get(e.target);
        const isSameGroup = (gS === gT);

        let gapKey = "";
        if (isSameGroup) {
            const leftX = Math.min(srcPos.x, tgtPos.x);
            const rightX = Math.max(srcPos.x, tgtPos.x);
            gapKey = `H:${gS}:${leftX}:${rightX}`;
        } else {
            const topY = Math.min(groupPositions.get(gS)?.y || 0, groupPositions.get(gT)?.y || 0);
            const bottomY = Math.max(groupPositions.get(gS)?.y || 0, groupPositions.get(gT)?.y || 0);
            gapKey = `V:${topY}:${bottomY}`;
        }

        gapEdgeCount.set(gapKey, (gapEdgeCount.get(gapKey) || 0) + 1);
        gapEdgeIndex.set(e.id, gapEdgeCount.get(gapKey) - 1);
    });

    const edges = normalEdges.map((e) => {
        const isDynamic = e.lineType === "dynamic";
        const srcPos = posMap.get(e.source);
        const tgtPos = posMap.get(e.target);

        let sourceHandle = "bottom-handle";
        let targetHandle = "top-handle";
        let customCenterY = undefined;
        let customCenterX = undefined;

        if (srcPos && tgtPos) {
            const gS = nodeToGroup.get(e.source);
            const gT = nodeToGroup.get(e.target);
            const isSameGroup = (gS === gT);

            let gapKey = "";
            if (isSameGroup) {
                const leftX = Math.min(srcPos.x, tgtPos.x);
                const rightX = Math.max(srcPos.x, tgtPos.x);
                gapKey = `H:${gS}:${leftX}:${rightX}`;
            } else {
                const topY = Math.min(groupPositions.get(gS)?.y || 0, groupPositions.get(gT)?.y || 0);
                const bottomY = Math.max(groupPositions.get(gS)?.y || 0, groupPositions.get(gT)?.y || 0);
                gapKey = `V:${topY}:${bottomY}`;
            }

            const count = gapEdgeCount.get(gapKey) || 1;
            const index = gapEdgeIndex.get(e.id) || 0;
            const offset = (index - (count - 1) / 2) * 24;

            if (isSameGroup) {
                sourceHandle = srcPos.x > tgtPos.x ? "left-handle" : "right-handle";
                targetHandle = srcPos.x > tgtPos.x ? "right-handle" : "left-handle";
                if (srcPos.x !== tgtPos.x) {
                    const srcEdgeX = srcPos.x > tgtPos.x ? srcPos.x : srcPos.x + NODE_WIDTH;
                    const tgtEdgeX = tgtPos.x > srcPos.x ? tgtPos.x : tgtPos.x + NODE_WIDTH;
                    customCenterX = (srcEdgeX + tgtEdgeX) / 2 + offset;
                } else if (srcPos.y !== tgtPos.y) {
                    // fallback if X matches perfectly, vertically separated nodes in same group (rare but possible)
                    customCenterX = srcPos.x + NODE_WIDTH + 40 + offset;
                }
            } else {
                sourceHandle = srcPos.y > tgtPos.y ? "top-handle" : "bottom-handle";
                targetHandle = srcPos.y > tgtPos.y ? "bottom-handle" : "top-handle";

                const gSBox = groupPositions.get(gS);
                const gSSize = groupSizes.get(gS);
                const gTBox = groupPositions.get(gT);
                const gTSize = groupSizes.get(gT);

                if (gSBox && gTBox && gSBox.y !== gTBox.y) {
                    if (gSBox.y < gTBox.y) {
                        const gapTop = gSBox.y + gSSize.height;
                        const gapBottom = gTBox.y;
                        customCenterY = (gapTop + gapBottom) / 2 + offset;
                    } else {
                        const gapTop = gTBox.y + gTSize.height;
                        const gapBottom = gSBox.y;
                        customCenterY = (gapTop + gapBottom) / 2 + offset;
                    }
                }
            }
        }

        return {
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle,
            targetHandle,
            type: "smart",
            updatable: true,
            label: e.daysText,
            labelStyle: { fill: "#17324d", fontSize: "13px", fontWeight: 700 },
            labelBgPadding: [8, 4],
            labelBgBorderRadius: 4,
            labelBgStyle: { fill: "#eef4fb", color: "#17324d" },
            style: { ...edgeStyle(isDynamic ? "dynamic" : "fixed") },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "#38557a",
                width: 20,
                height: 20,
            },
            data: {
                lineType: e.lineType,
                daysText: e.daysText,
                customCenterX,
                customCenterY,
            },
        };
    });

    selfLoops.forEach((e) => {
        const isDynamic = e.lineType === "dynamic";
        edges.push({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: "top-handle",
            targetHandle: "right-handle",
            type: "smoothstep",
            updatable: true,
            label: e.daysText,
            labelStyle: { fill: "#17324d", fontSize: "13px", fontWeight: 700 },
            labelBgPadding: [8, 4],
            labelBgBorderRadius: 4,
            labelBgStyle: { fill: "#eef4fb", color: "#17324d" },
            style: { ...edgeStyle(isDynamic ? "dynamic" : "fixed") },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "#38557a",
                width: 20,
                height: 20,
            },
            data: { lineType: e.lineType, daysText: e.daysText },
        });
    });

    return { nodes, edges };
}
