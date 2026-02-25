import axios from "axios";

export const SmartIdTypeEnum = {
    PROMOTION_REGION: "PromotionRegion",
    BASIC_CROP_SPECIES: "BasicCropSpecies",
    BASIC_CROP_VARIETY: "BasicCropVariety",
    CROP_PLANTING_TEMPLATE: "CropPlantingTemplate",
    BTU_TEMPLATE: "BtuTemplate", // node
    BTU_TEMPLATE_DEPENDENCY: "BtuTemplateDependency", // edge
    TIME_WINDOW_PARAMETER: "TimeWindowParameter",
    BTU_TEMPLATE_ADMITTANCE_CONDITION: "BtuTemplateAdmittanceCondition",
    BTU_TEMPLATE_SUBJECT: "BtuTemplateSubject",
    BTU_TEMPLATE_TERM: "BtuTemplateTerm",
    BTU_TEMPLATE_CORRECTION: "BtuTemplateCorrection",
    BTU_TEMPLATE_IMPACT: "BtuTemplateImpact",
};

export async function generateSmartId(textType) {
    try {
        const params = new URLSearchParams();
        params.append("text", textType);

        const res = await axios.post(
            "/smartId/generate",
            params,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );
        if (res.data?.success || res.data?.code === 200) {
            return res.data?.data || res.data;
        }
        return res.data;
    } catch (error) {
        console.error(`Error generating ID for ${textType}:`, error);
        return `ID_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
}
