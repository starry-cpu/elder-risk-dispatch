import { ref } from 'vue';

export function useSosVoice() {
  const isRecording = ref(false);
  const voiceUrl = ref('');
  const duration = ref(0);
  const maxDuration = 60;

  let timer: ReturnType<typeof setInterval> | null = null;

  function startRecording() {
    isRecording.value = true;
    duration.value = 0;
    timer = setInterval(() => {
      duration.value++;
      if (duration.value >= maxDuration) {
        stopRecording();
      }
    }, 1000);
  }

  function stopRecording() {
    isRecording.value = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function setVoiceUrl(url: string) {
    voiceUrl.value = url;
  }

  function clear() {
    voiceUrl.value = '';
    duration.value = 0;
    isRecording.value = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    isRecording,
    voiceUrl,
    duration,
    maxDuration,
    startRecording,
    stopRecording,
    setVoiceUrl,
    clear,
  };
}
