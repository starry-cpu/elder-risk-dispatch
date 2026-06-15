import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSosVoice } from '../useSosVoice';

// 构造一个假的 RecorderManager，可触发 onStart/onStop 回调
function createMockRecorder() {
  const handlers: Record<string, Function> = {};
  return {
    recorder: {
      start: vi.fn(() => {
        handlers.onStart?.();
      }),
      stop: vi.fn(() => {
        handlers.onStop?.({ tempFilePath: '/tmp/rec.mp3', duration: 3000 });
      }),
      onStart: vi.fn((cb: Function) => { handlers.onStart = cb; }),
      onStop: vi.fn((cb: Function) => { handlers.onStop = cb; }),
    },
    handlers,
  };
}

describe('useSosVoice (real recording)', () => {
  let mockRecorder: ReturnType<typeof createMockRecorder>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRecorder = createMockRecorder();
    vi.stubGlobal('uni', {
      getRecorderManager: () => mockRecorder.recorder,
    });
  });

  it('startRecording sets isRecording true and calls recorder.start with mp3 format', () => {
    const { isRecording, startRecording } = useSosVoice();
    startRecording();
    expect(isRecording.value).toBe(true);
    expect(mockRecorder.recorder.start).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'mp3' }),
    );
  });

  it('stopRecording triggers onStop and records tempFilePath', () => {
    const { isRecording, duration, recordedFilePath, startRecording, stopRecording } = useSosVoice();
    startRecording();
    vi.advanceTimersByTime(3000); // 3s 计时
    stopRecording();

    expect(isRecording.value).toBe(false);
    expect(recordedFilePath.value).toBe('/tmp/rec.mp3');
  });

  it('duration increments via timer while recording', () => {
    const { duration, startRecording } = useSosVoice();
    startRecording();
    vi.advanceTimersByTime(2000);
    expect(duration.value).toBe(2);
  });

  it('uploading ref defaults to false', () => {
    const { uploading } = useSosVoice();
    expect(uploading.value).toBe(false);
  });

  it('auto-stops at maxDuration (60s) by calling recorder.stop', () => {
    const { startRecording } = useSosVoice();
    startRecording();
    // 推进到 60s，setInterval 应触发自动停止
    vi.advanceTimersByTime(60000);
    expect(mockRecorder.recorder.stop).toHaveBeenCalled();
  });

  it('does not loop recorder.stop when onStop never fires (stuck-timer guard)', () => {
    // 模拟 recorder.stop 不触发 onStop 的异常场景
    mockRecorder.recorder.stop.mockImplementation(() => {});
    const { startRecording, stopRecording } = useSosVoice();
    startRecording();
    stopRecording();
    stopRecording();
    // 幂等守卫：onStop 未触发时不应反复调用 recorder.stop
    expect(mockRecorder.recorder.stop).toHaveBeenCalledTimes(1);
  });

  it('clear resets recording state and recorded file path', () => {
    const { recordedFilePath, duration, isRecording, startRecording, stopRecording, clear } = useSosVoice();
    startRecording();
    vi.advanceTimersByTime(2000);
    stopRecording();
    expect(recordedFilePath.value).toBe('/tmp/rec.mp3');

    clear();
    expect(recordedFilePath.value).toBe('');
    expect(duration.value).toBe(0);
    expect(isRecording.value).toBe(false);
  });
});
