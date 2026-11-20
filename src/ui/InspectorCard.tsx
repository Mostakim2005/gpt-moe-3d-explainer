import { useSceneStore } from '../state/useSceneStore';
import { getInspectInfo } from '../content/inspectorData';

/** Floating detail card shown inside the 3D stage when a user clicks a part. */
export function InspectorCard() {
  const selected = useSceneStore((s) => s.selected);
  const setSelected = useSceneStore((s) => s.setSelected);

  if (!selected) return null;
  const info = getInspectInfo(selected);
  if (!info) return null;

  return (
    <aside className="inspector-card" role="region" aria-label="Selected component details">
      <div className="inspector-head">
        <span className="inspector-kicker">Inspecting</span>
        <button
          className="inspector-close"
          onClick={() => setSelected(null)}
          aria-label="Close inspector"
          title="Close (Esc)"
        >
          ×
        </button>
      </div>
      <h3>{info.title}</h3>
      <div className="inspector-meta">
        <span>{info.shape}</span>
        <code>{info.formula}</code>
      </div>
      <p>{info.note}</p>
    </aside>
  );
}
