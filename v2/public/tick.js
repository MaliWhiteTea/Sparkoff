let timer;
self.onmessage = (event) => {
  if (event.data?.type === 'start') {
    clearInterval(timer);
    timer = setInterval(() => self.postMessage({ type: 'tick' }), Math.max(1000, event.data.interval || 4000));
  }
  if (event.data?.type === 'stop') clearInterval(timer);
};
