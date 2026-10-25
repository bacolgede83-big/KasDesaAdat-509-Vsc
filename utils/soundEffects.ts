// =========================================================================
// SISTEM AUDIO BEEP & EFEK SUARA CERDAS (WEB AUDIO API)
// Desa Adat Accounting System
// =========================================================================

class SoundEffectsService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Muat preferensi suara dari localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('app_sound_enabled');
      this.isMuted = stored === 'false';
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.isMuted = !enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_sound_enabled', enabled ? 'true' : 'false');
    }
  }

  public isEnabled(): boolean {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('app_sound_enabled');
      if (stored !== null) return stored !== 'false';
    }
    return !this.isMuted;
  }

  /**
   * Suara saat data belum disinkronkan / Peringatan Unsynced
   * Double beep lembut penarik perhatian
   */
  public playUnsyncedWarning() {
    if (!this.isEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Beep 1: 587Hz (D5)
    this.playTone(ctx, 587.33, 'triangle', now, 0.12, 0.18);
    // Beep 2: 784Hz (G5)
    this.playTone(ctx, 783.99, 'sine', now + 0.14, 0.16, 0.22);
  }

  /**
   * Suara saat Terjadi Kesalahan / Error
   * Nada peringatan rendah 2 nada
   */
  public playError() {
    if (!this.isEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Nada 1: 220Hz (A3)
    this.playTone(ctx, 220, 'sawtooth', now, 0.15, 0.22, 0.01, 0.14);
    // Nada 2: 174.61Hz (F3)
    this.playTone(ctx, 174.61, 'sawtooth', now + 0.16, 0.25, 0.25, 0.01, 0.24);
  }

  /**
   * Suara saat Berhasil Menyinkronkan Data
   * Nada arpeggio naik ceria & merdu (C5 - E5 - G5 - C6)
   */
  public playSyncSuccess() {
    if (!this.isEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, idx) => {
      this.playTone(ctx, freq, 'sine', now + idx * 0.08, 0.2, 0.25);
    });
  }

  /**
   * Suara saat Berhasil Menyimpan Transaksi (Jurnal Umum, BKU, Penerimaan)
   * Nada konfirmasi positif (C5 -> G5)
   */
  public playSaveSuccess() {
    if (!this.isEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // C5 (523Hz) lalu E5 (659Hz) lalu G5 (784Hz)
    this.playTone(ctx, 523.25, 'sine', now, 0.12, 0.2);
    this.playTone(ctx, 659.25, 'sine', now + 0.09, 0.12, 0.22);
    this.playTone(ctx, 783.99, 'sine', now + 0.18, 0.28, 0.25);
  }

  /**
   * Suara saat Berhasil Mengedit / Memperbarui Data
   * Nada melodi lembut 2-nada (D5 -> A5)
   */
  public playEditSuccess() {
    if (!this.isEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playTone(ctx, 587.33, 'sine', now, 0.12, 0.18);
    this.playTone(ctx, 880.00, 'sine', now + 0.11, 0.22, 0.22);
  }

  /**
   * Suara saat Berhasil Menghapus Data
   * Nada desendens lembut (G5 -> D5 -> A4)
   */
  public playDeleteSuccess() {
    if (!this.isEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playTone(ctx, 659.25, 'triangle', now, 0.1, 0.16);
    this.playTone(ctx, 440.00, 'sine', now + 0.09, 0.18, 0.18);
  }

  /**
   * Helper pembuatan synthesizer tone individual
   */
  private playTone(
    ctx: AudioContext, 
    freq: number, 
    type: OscillatorType, 
    startTime: number, 
    duration: number, 
    maxGain: number = 0.2,
    attackTime: number = 0.02,
    releaseTime?: number
  ) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Amplop Suara (ADSR)
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(maxGain, startTime + attackTime);
      
      const actualRelease = releaseTime || (duration - attackTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + attackTime + actualRelease);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch {
      // Abaikan jika browser memblokir audio sementara
    }
  }
}

export const soundEffects = new SoundEffectsService();

// Shortcut export functions
export const playUnsyncedSound = () => soundEffects.playUnsyncedWarning();
export const playErrorSound = () => soundEffects.playError();
export const playSyncSuccessSound = () => soundEffects.playSyncSuccess();
export const playSaveSuccessSound = () => soundEffects.playSaveSuccess();
export const playEditSuccessSound = () => soundEffects.playEditSuccess();
export const playDeleteSuccessSound = () => soundEffects.playDeleteSuccess();
