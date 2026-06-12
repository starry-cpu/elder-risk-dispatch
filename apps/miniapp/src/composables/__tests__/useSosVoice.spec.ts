import { describe, it, expect } from 'vitest';
import { useSosVoice } from '../useSosVoice';

describe('useSosVoice', () => {
  it('initializes with idle recording state', () => {
    const { isRecording, voiceUrl, duration } = useSosVoice();
    expect(isRecording.value).toBe(false);
    expect(voiceUrl.value).toBe('');
    expect(duration.value).toBe(0);
  });
  it('transitions through recording states', () => {
    const { isRecording, startRecording, stopRecording } = useSosVoice();
    startRecording();
    expect(isRecording.value).toBe(true);
    stopRecording();
    expect(isRecording.value).toBe(false);
  });
  it('has max duration of 60 seconds', () => {
    const { maxDuration } = useSosVoice();
    expect(maxDuration).toBe(60);
  });
  it('clear resets state', () => {
    const { voiceUrl, duration, setVoiceUrl, clear } = useSosVoice();
    setVoiceUrl('https://example.com/audio.mp3');
    duration.value = 45;
    clear();
    expect(voiceUrl.value).toBe('');
    expect(duration.value).toBe(0);
  });
});
