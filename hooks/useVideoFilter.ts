import { useMemo } from 'react';

export type FilterConfig = {
    brightness?: number;
    contrast?: number;
    saturate?: number;
    sepia?: number;
    grayscale?: number;
    url?: string;
    order?: (keyof FilterConfig)[];
};

export const filterPresets: Record<string, FilterConfig> = {
    '標準': {},
    '電影感': { contrast: 1.15, saturate: 1.2, sepia: 0.1 },
    '鮮豔': { contrast: 1.25, saturate: 1.4 },
    '柔和': { contrast: 0.9, brightness: 1.1, sepia: 0.15 },
    '黑白': { grayscale: 1, contrast: 1.1 },
    '夜視增強': { url: '#low-light-enhance', contrast: 1.1 },
};

export function useVideoFilter(baseBrightness: number, filterName: string) {
    return useMemo(() => {
        const config = filterPresets[filterName] || filterPresets['標準'];
        const mergedConfig = { ...config };
        
        // Combine base brightness from gestures with preset brightness
        if (mergedConfig.brightness !== undefined) {
            mergedConfig.brightness *= baseBrightness;
        } else {
            mergedConfig.brightness = baseBrightness;
        }

        // Default custom application order.
        const defaultOrder: (keyof FilterConfig)[] = ['brightness', 'url', 'contrast', 'saturate', 'sepia', 'grayscale'];
        const order = config.order || defaultOrder;
        
        const filterChunks = order.map(key => {
            const val = mergedConfig[key];
            if (val === undefined) return null;
            if (key === 'url') return `url(${val})`;
            return `${key}(${val})`;
        }).filter(Boolean);

        return filterChunks.join(' ');
    }, [baseBrightness, filterName]);
}
