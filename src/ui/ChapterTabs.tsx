import { useSceneStore } from '../state/useSceneStore';
import { chapters } from '../content';

export function ChapterTabs() {
  const chapter = useSceneStore((s) => s.chapter);
  const setChapter = useSceneStore((s) => s.setChapter);

  return (
    <div className="chapter-tabs">
      {chapters.map((c) => (
        <button
          key={c.id}
          className={c.id === chapter ? 'tab active' : 'tab'}
          onClick={() => setChapter(c.id)}
          aria-pressed={c.id === chapter}
        >
          <span className="tab-label">
            {c.label}
            <span className="tab-count">{c.steps.length} steps</span>
          </span>
          <span className="tab-blurb">{c.blurb}</span>
        </button>
      ))}
    </div>
  );
}
