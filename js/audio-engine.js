const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const graphs = new WeakMap();
let context = null;
let webAudioUnavailable = !AudioContextClass;

function ensureGraph(audio, volume) {
  if (webAudioUnavailable) {
    audio.volume = volume;
    return null;
  }
  try {
    if (!context) context = new AudioContextClass();
    let graph = graphs.get(audio);
    if (!graph) {
      const source = context.createMediaElementSource(audio);
      const gain = context.createGain();
      source.connect(gain);
      gain.connect(context.destination);
      graph = { source, gain };
      graphs.set(audio, graph);
    }
    graph.gain.gain.setValueAtTime(volume, context.currentTime);
    return graph;
  } catch {
    webAudioUnavailable = true;
    audio.volume = volume;
    return null;
  }
}

export async function preparePlayback(audio, volume) {
  const graph = ensureGraph(audio, volume);
  if (graph && context.state === "suspended") await context.resume();
}

export function setPlaybackVolume(audio, volume) {
  const graph = graphs.get(audio);
  if (!graph || !context || context.state === "closed") {
    audio.volume = volume;
    return;
  }
  graph.gain.gain.setTargetAtTime(volume, context.currentTime, 0.005);
}
