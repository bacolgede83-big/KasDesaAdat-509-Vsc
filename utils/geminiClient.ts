import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL_TEXT = 'gemini-3.8-flash';
export const GEMINI_FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

/**
 * Mendapatkan API Key Gemini yang aktif:
 * 1. Penyimpanan lokal pengguna (localStorage)
 * 2. Environment variable Vite / Node (VITE_GEMINI_API_KEY / GEMINI_API_KEY)
 */
export const getGeminiApiKey = (): string => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('custom_gemini_api_key') || localStorage.getItem('VITE_GEMINI_API_KEY');
    if (custom && custom.trim()) {
      return custom.trim();
    }
  }

  // Cek env variables
  const envKey = (typeof process !== 'undefined' && (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY)) || '';
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }

  try {
    const metaKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (metaKey && metaKey.trim()) {
      return metaKey.trim();
    }
  } catch {
    // Ignore error in non-module environments
  }

  return '';
};

/**
 * Menyimpan custom API Key ke localStorage
 */
export const setCustomGeminiApiKey = (key: string): void => {
  if (typeof window !== 'undefined') {
    if (key && key.trim()) {
      localStorage.setItem('custom_gemini_api_key', key.trim());
      localStorage.setItem('VITE_GEMINI_API_KEY', key.trim());
    } else {
      localStorage.removeItem('custom_gemini_api_key');
      localStorage.removeItem('VITE_GEMINI_API_KEY');
    }
    // Dispatch event so UI components can re-render if needed
    window.dispatchEvent(new Event('gemini-key-updated'));
  }
};

/**
 * Helper untuk masking API Key agar aman ditampilkan di UI
 */
export const maskApiKey = (key: string): string => {
  if (!key) return 'Belum terkonfigurasi';
  if (key.length <= 10) return '••••••••••';
  return `${key.slice(0, 7)}...${key.slice(-6)}`;
};

/**
 * Menginisialisasi client GoogleGenAI dengan API Key aktif
 */
export const getGeminiClient = (customKey?: string): GoogleGenAI => {
  const apiKey = (customKey && customKey.trim()) || getGeminiApiKey();
  return new GoogleGenAI({
    apiKey
  });
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientError = (err: any): boolean => {
  const msg = (err?.message || String(err)).toLowerCase();
  const status = err?.status || err?.code || 0;
  return (
    status === 503 ||
    status === 429 ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('high demand')
  );
};

export interface GenerateWithFallbackOptions {
  prompt: string;
  systemInstruction?: string;
  customKey?: string;
  onRetryNotice?: (message: string) => void;
}

/**
 * Memanggil Gemini API dengan mekanisme Automatic Retry & Fallback Models
 * Menangani kendala Server Overloaded / HTTP 503 Unavailable secara cerdas
 */
export const generateContentWithFallback = async ({
  prompt,
  systemInstruction,
  customKey,
  onRetryNotice
}: GenerateWithFallbackOptions): Promise<{ text: string; modelUsed: string }> => {
  const apiKey = (customKey && customKey.trim()) || getGeminiApiKey();
  const ai = getGeminiClient(apiKey);
  let lastError: any = null;

  for (const modelName of GEMINI_FALLBACK_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: systemInstruction ? { systemInstruction } : undefined
        });

        const text = response.text?.trim() || '';
        if (text) {
          return { text, modelUsed: modelName };
        }
      } catch (err: any) {
        lastError = err;
        const isTransient = isTransientError(err);
        
        if (isTransient) {
          if (attempt === 1) {
            onRetryNotice?.(`Server Google (${modelName}) sedang padat (503). Menunggu jeda 1,5 detik...`);
            await delay(1500);
            continue;
          } else {
            onRetryNotice?.(`Model ${modelName} sedang overload. Beralih ke model alternatif...`);
          }
        } else {
          // Non-transient error on this model, try next model
          break;
        }
      }
    }
  }

  throw lastError || new Error('Seluruh model Gemini API sedang mengalami beban tinggi (503).');
};

export interface GeminiTestResult {
  success: boolean;
  message: string;
  response?: string;
  latencyMs?: number;
  model: string;
  apiKeyMasked: string;
}

/**
 * Fungsi untuk menguji koneksi dan kapabilitas Gemini API secara langsung (Tes Kode)
 */
export const testGeminiConnection = async (customKey?: string): Promise<GeminiTestResult> => {
  const apiKey = (customKey && customKey.trim()) || getGeminiApiKey();
  const startTime = Date.now();

  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      message: 'API Key Gemini kosong atau tidak ditemukan.',
      model: GEMINI_MODEL_TEXT,
      apiKeyMasked: maskApiKey(apiKey)
    };
  }

  try {
    const result = await generateContentWithFallback({
      prompt: 'Tes koneksi sistem keuangan Desa Adat. Jawab singkat: "Sistem Gemini AI Aktif & Siap Menganalisis Keuangan Desa Adat."',
      systemInstruction: 'Anda adalah asisten cerdas sistem keuangan desa adat. Jawab singkat dan padat.',
      customKey: apiKey
    });

    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      message: `Koneksi Gemini AI Berhasil! (Model: ${result.modelUsed})`,
      response: result.text,
      latencyMs,
      model: result.modelUsed,
      apiKeyMasked: maskApiKey(apiKey)
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const errMsg = err?.message || String(err) || 'Terjadi kesalahan saat memanggil Gemini API';
    return {
      success: false,
      message: `Gagal terhubung ke Gemini: ${errMsg}`,
      latencyMs,
      model: GEMINI_MODEL_TEXT,
      apiKeyMasked: maskApiKey(apiKey)
    };
  }
};
