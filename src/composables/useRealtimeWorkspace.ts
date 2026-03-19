import { onBeforeUnmount, onMounted } from 'vue';

type RealtimeWorkspaceOptions = {
  intervalMs?: number;
  enabled?: boolean;
};

export function useRealtimeWorkspace(
  refresh: () => void | Promise<void>,
  options: RealtimeWorkspaceOptions = {}
): void {
  const enabled = options.enabled !== false;
  const intervalMs = Math.max(3_000, options.intervalMs || 5_000);
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  if (!enabled) return;

  const runRefresh = async (): Promise<void> => {
    if (running || document.hidden) return;
    running = true;
    try {
      await refresh();
    } finally {
      running = false;
    }
  };

  const startTimer = (): void => {
    if (timer) return;
    timer = setInterval(() => {
      void runRefresh();
    }, intervalMs);
  };

  const stopTimer = (): void => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  const handleVisibilityChange = (): void => {
    if (document.hidden) {
      stopTimer();
      return;
    }
    startTimer();
    void runRefresh();
  };

  const handleFocus = (): void => {
    void runRefresh();
  };

  onMounted(() => {
    startTimer();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
  });

  onBeforeUnmount(() => {
    stopTimer();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
  });
}
