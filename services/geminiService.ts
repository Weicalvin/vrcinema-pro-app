import { GoogleGenAI, Type } from "@google/genai";
import { VideoContent } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in environment.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const fetchRecommendedContent = async (query: string): Promise<VideoContent[]> => {
  const ai = getAiClient();
  if (!ai) {
    // Fallback data if no API key
    return [
      { id: '1', title: '星際之旅 360', thumbnail: 'https://picsum.photos/400/225', duration: '5:20', type: '360', category: '科幻' },
      { id: '2', title: 'VR 雲霄飛車', thumbnail: 'https://picsum.photos/400/226', duration: '3:15', type: 'VR', category: '體驗' },
      { id: '3', title: '深海潛水', thumbnail: 'https://picsum.photos/400/227', duration: '12:00', type: '2D', category: '紀錄片' },
    ];
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a list of 6 fictional popular VR/3D video titles related to "${query}" that might be found in a VR app. ALL titles and descriptions MUST be in Traditional Chinese (繁體中文). include categories like 3D Movie, VR Game, Scenery. Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['2D', '3D', 'VR', '360'] },
              duration: { type: Type.STRING },
              category: { type: Type.STRING },
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || '[]');
    // Add placeholders since GenAI doesn't generate real images/urls
    return data.map((item: any, index: number) => ({
      ...item,
      thumbnail: `https://picsum.photos/400/${225 + index}`,
      url: '' // In a real app, this would be a real URL
    }));

  } catch (error) {
    console.error("Gemini fetch failed:", error);
    return [];
  }
};