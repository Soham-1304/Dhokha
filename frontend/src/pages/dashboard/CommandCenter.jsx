import MetricsStrip from '../../components/dashboard/MetricsStrip';
import SwarmSelector from '../../components/dashboard/SwarmSelector';
import ForceGraph from '../../components/dashboard/ForceGraph';
import ExplainPanel from '../../components/dashboard/ExplainPanel';
import LiveTicker from '../../components/dashboard/LiveTicker';
import SwarmToast from '../../components/dashboard/SwarmToast';

export default function CommandCenter() {
  return (
    <div className="db-command-center">
      <div className="db-cc-header">
        <div className="db-cc-title">
          <span className="db-eyebrow" style={{ marginBottom: 0 }}>Command Center</span>
          <div className="db-cc-live-dot">
            <span className="db-live-pulse"></span>
            LIVE
          </div>
        </div>
        <MetricsStrip />
      </div>

      <div className="db-cc-main">
        <SwarmSelector />
        <div className="db-graph-panel">
          <ForceGraph />
        </div>
        <ExplainPanel />
      </div>

      <LiveTicker />

      <SwarmToast />
    </div>
  );
}
