import { ref } from 'vue';

// 工厂函数：惰性获取 RecorderManager，便于测试 mock
function getRecorder() {
  return uni.getRecorderManager();
}

export function useSosVoice() {
  const isRecording = ref(false);
  const duration = ref(0);
  const maxDuration = 60;
  // uploading 由调用方（页面）在上传期间切换，composable 只负责暴露该状态位
  const uploading = ref(false);
  const recordedFilePath = ref('');

  const recorder = getRecorder();
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopping = false;

  recorder.onStart(() => {
    isRecording.value = true;
    duration.value = 0;
    stopping = false;
  });

  recorder.onStop((res: { tempFilePath: string; duration: number }) => {
    isRecording.value = false;
    recordedFilePath.value = res.tempFilePath;
    stopping = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });

  function startRecording() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    recordedFilePath.value = '';
    // format 选 mp3：满足后端 check-ins 的 .mp3 校验
    recorder.start({ format: 'mp3', duration: 60000, sampleRate: 16000, numberOfChannels: 1 });
    // duration 计时用 setInterval（recorder 自身到 onStop 才给真实时长）
    timer = setInterval(() => {
      duration.value++;
      if (duration.value >= maxDuration) {
        stopRecording();
      }
    }, 1000);
  }

  function stopRecording() {
    // 幂等守卫：避免 onStop 未触发时 setInterval 反复调用 recorder.stop 造成空转
    if (stopping) return;
    stopping = true;
    recorder.stop(); // 实际停止 + 触发 onStop 回调
  }

  function clear() {
    recordedFilePath.value = '';
    duration.value = 0;
    isRecording.value = false;
    stopping = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    isRecording,
    duration,
    maxDuration,
    uploading,
    recordedFilePath,
    startRecording,
    stopRecording,
    clear,
  };
}
