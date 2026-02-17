
import { GoogleGenAI, Type } from "@google/genai";

// Create a helper function to instantiate the AI client with the latest API key
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getRoasteryInsights(dataSummary: string) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `بصفتك مستشارًا لخبير في تحميص القهوة، قم بتحليل البيانات التالية لمحمصة الدوحة وقدم نصائح تشغيلية لتحسين الكفاءة وتقليل الهدر وزيادة المبيعات.
      البيانات: ${dataSummary}`,
      config: {
        systemInstruction: "You are an expert Coffee Business Consultant. Speak professionally in Arabic.",
        temperature: 0.7,
      },
    });
    // response.text is a property, not a method
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "تعذر الحصول على تحليلات حالياً. يرجى المحاولة لاحقاً.";
  }
}

export async function predictStockNeeds(history: any[]) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `بناءً على تاريخ المبيعات هذا: ${JSON.stringify(history)}، ما هي توقعات المخزون للأسبوع القادم؟ أجب بتنسيق JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING },
                  predictedQuantity: { type: Type.NUMBER },
                  reason: { type: Type.STRING }
                },
                required: ["item", "predictedQuantity", "reason"]
              }
            }
          },
          required: ["recommendations"]
        }
      }
    });
    // response.text is a property, not a method
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini stock prediction error:", error);
    return { recommendations: [] };
  }
}
