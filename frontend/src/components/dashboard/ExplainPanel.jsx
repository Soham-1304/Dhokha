import useDashboardStore from '../../store/dashboardStore';
import { explainability } from '../../api/mock/explainability';
import ShapBarChart from './ShapBarChart';

const VERDICT_COLORS = {
  'SWARM': '#e5484d',
  'CONFIRMED MULE': '#e5484d',
  'FLAGGED': '#c9a227',
  'DEVICE CLUSTER HUB': '#7c6af0',
};

export default function ExplainPanel() {
  const selectedNode = useDashboardStore(s => s.selectedNode);

  const data = selectedNode ? explainability[selectedNode] : null;

  if (!selectedNode || !data) {
    return (
      <div className="db-panel db-explain-panel db-explain-empty">
        <div className="db-panel-header">
          <span className="db-eyebrow">Investigation</span>
        </div>
        <div className="db-explain-placeholder">
          <div className="db-explain-icon">◎</div>
          <p>Click a node on the graph to investigate.</p>
        </div>
      </div>
    );
  }

  const verdictColor = VERDICT_COLORS[data.verdict] || '#9b968c';

  return (
    <div className="db-panel db-explain-panel">
      <div className="db-panel-header">
        <span className="db-eyebrow">Investigation</span>
        <span
          className="db-verdict-badge"
          style={{ background: `${verdictColor}22`, color: verdictColor, border: `1px solid ${verdictColor}55` }}
        >
          {data.verdict}
        </span>
      </div>

      <div className="db-explain-id">{data.accountId}</div>
      <div className="db-explain-name">{data.name}</div>
      {data.bank && <div className="db-explain-meta">Bank {data.bank} · {data.city}</div>}

      <div className="db-explain-scores">
        {data.stage1Score !== null && (
          <div className="db-score-row">
            <span className="db-score-lab">Stage 1</span>
            <div className="db-score-bar-wrap">
              <div className="db-score-bar" style={{ width: `${data.stage1Score * 100}%`, background: '#c9a227' }}></div>
            </div>
            <span className="db-score-val">{(data.stage1Score * 100).toFixed(0)}%</span>
          </div>
        )}
        {data.stage2Score !== null && (
          <div className="db-score-row">
            <span className="db-score-lab">Stage 2</span>
            <div className="db-score-bar-wrap">
              <div className="db-score-bar" style={{ width: `${data.stage2Score * 100}%`, background: '#e5484d' }}></div>
            </div>
            <span className="db-score-val">{(data.stage2Score * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>

      <div className="db-shap-title">SHAP Feature Contributions</div>
      <ShapBarChart features={data.features} />
    </div>
  );
}
