import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  connectEventStream,
  getAlerts,
  getSubgraph,
  injectSwarm,
  resetDemo,
} from '../api/client';
import './GraphExplorer.css';

const SWARMS = [
  { id: 'A', label: 'Identity fan-out' },
  { id: 'B', label: 'Mule fan-in' },
  { id: 'C', label: 'Layering chain' },
  { id: 'D', label: 'Shared device' },
];

const SWARM_TITLES = {
  A: 'Cross-bank identity fan-out',
  B: 'Mule collector fan-in',
  C: 'Layering chain or cycle',
  D: 'Shared-device account cluster',
};

function formatCurrency(value = 0) {
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function normalizeGraph(graph) {
  return {
    nodes: graph.nodes.map(node => ({
      ...node,
      type: node.node_type || 'account',
      label: node.id,
      bank: node.bank_id,
      risk: Math.round((node.risk || 0) * 100),
    })),
    edges: graph.edges.map(edge => ({ ...edge })),
  };
}

export default function GraphExplorer() {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [alerts, setAlerts] = useState([]);
  const [activeAlertId, setActiveAlertId] = useState(null);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [accountId, setAccountId] = useState('ACC-000');
  const [operation, setOperation] = useState('');
  const [error, setError] = useState('');
  const [streamStatus, setStreamStatus] = useState('connecting');
  const [lastEvent, setLastEvent] = useState(null);

  const activeAlert = alerts.find(alert => alert.id === activeAlertId) || null;

  const loadGraph = useCallback(async (targetAccountId) => {
    const requestedAccount = targetAccountId.trim();
    if (!requestedAccount) return;
    setOperation('Loading graph');
    setError('');
    try {
      const response = await getSubgraph(requestedAccount, 2);
      setGraph(normalizeGraph(response));
      setAccountId(requestedAccount);
      setSelectedNode(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOperation('');
    }
  }, []);

  const refreshAlerts = useCallback(async () => {
    const response = await getAlerts({ limit: 100 });
    setAlerts(response);
    return response;
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getAlerts({ limit: 100 }), getSubgraph('ACC-000', 2)])
      .then(([alertResponse, graphResponse]) => {
        if (!active) return;
        setAlerts(alertResponse);
        setGraph(normalizeGraph(graphResponse));
        if (alertResponse.length > 0) setActiveAlertId(alertResponse[0].id);
      })
      .catch(requestError => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const socket = connectEventStream({
      onOpen: () => setStreamStatus('online'),
      onEvent: event => {
        setLastEvent(event);
        if (event.event_type === 'swarm_confirmed') {
          refreshAlerts().catch(() => {});
        }
      },
      onError: () => setStreamStatus('offline'),
      onClose: () => setStreamStatus('offline'),
    });
    return () => socket.close();
  }, [refreshAlerts]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || graph.nodes.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 550;
    const nodes = graph.nodes.map(node => ({ ...node }));
    const edges = graph.edges.map(edge => ({ ...edge }));

    d3.select(svgRef.current).selectAll('*').remove();
    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    const canvas = svg.append('g');
    svg.call(d3.zoom().scaleExtent([0.35, 3]).on('zoom', event => {
      canvas.attr('transform', event.transform);
    }));

    const links = canvas.append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', 'var(--string)')
      .attr('stroke-width', edge => Math.max(1.2, (edge.confidence || 0) * 3))
      .attr('opacity', 0.78);

    const nodeGroups = canvas.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer')
      .on('click', (event, node) => {
        event.stopPropagation();
        setSelectedNode(node);
      });

    nodeGroups.append('circle')
      .attr('r', node => 9 + Math.min(node.risk / 25, 4))
      .attr('fill', node => node.risk >= 85 ? 'var(--risk-critical)' : 'var(--brass)')
      .attr('stroke', 'var(--bg)')
      .attr('stroke-width', 1.5);

    nodeGroups.append('text')
      .text(node => node.label)
      .attr('x', 15)
      .attr('y', 4)
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)');

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(node => node.id).distance(110))
      .force('charge', d3.forceManyBody().strength(-240))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(28));

    simulation.on('tick', () => {
      links
        .attr('x1', edge => edge.source.x)
        .attr('y1', edge => edge.source.y)
        .attr('x2', edge => edge.target.x)
        .attr('y2', edge => edge.target.y);
      nodeGroups.attr('transform', node => `translate(${node.x},${node.y})`);
    });

    if (!selectedNode) setSelectedNode(nodes[0]);
    return () => simulation.stop();
  }, [graph, selectedNode]);

  const selectAlert = async (alert) => {
    setActiveAlertId(alert.id);
    const targetAccount = alert.account_ids?.[0];
    if (targetAccount) await loadGraph(targetAccount);
  };

  const handleInject = async (swarmType) => {
    setOperation(`Injecting Type ${swarmType}`);
    setError('');
    try {
      const scenario = await injectSwarm(swarmType, 5);
      const latestAlerts = await refreshAlerts();
      const matchingAlert = latestAlerts.find(alert => alert.swarm_type === swarmType);
      if (matchingAlert) setActiveAlertId(matchingAlert.id);
      if (scenario.account_ids?.[0]) await loadGraph(scenario.account_ids[0]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOperation('');
    }
  };

  const handleReset = async () => {
    setOperation('Resetting demo');
    setError('');
    try {
      await resetDemo();
      const [alertResponse, graphResponse] = await Promise.all([
        getAlerts({ limit: 100 }),
        getSubgraph('ACC-000', 2),
      ]);
      setAlerts(alertResponse);
      setActiveAlertId(null);
      setGraph(normalizeGraph(graphResponse));
      setAccountId('ACC-000');
      setSelectedNode(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOperation('');
    }
  };

  return (
    <div className="explorer-layout dark-operations-board animate-in">
      <div className="workspace-columns-container live-investigation">
        <aside className="workspace-queue-column dossier-sheet live-queue">
          <div className="column-title-bar">
            <span>Live swarm controls</span>
            <span className={`live-stream-state ${streamStatus}`}>{streamStatus}</span>
          </div>

          <div className="live-swarm-controls">
            {SWARMS.map(swarm => (
              <button
                key={swarm.id}
                className="live-swarm-button"
                disabled={Boolean(operation)}
                onClick={() => handleInject(swarm.id)}
              >
                <strong>Type {swarm.id}</strong>
                <span>{swarm.label}</span>
              </button>
            ))}
            <button className="live-reset-button" disabled={Boolean(operation)} onClick={handleReset}>
              ↺ Reset deterministic demo
            </button>
          </div>

          <div className="column-title-bar">
            <span>Confirmed alerts ({alerts.length})</span>
          </div>
          <div className="queue-list">
            {alerts.length === 0 ? (
              <div className="live-empty-copy">No alerts. Inject a swarm to create a live case.</div>
            ) : alerts.map(alert => (
              <button
                key={alert.id}
                className={`queue-item-card live-alert-card ${activeAlertId === alert.id ? 'active' : ''}`}
                onClick={() => selectAlert(alert)}
              >
                <span className="queue-top">
                  <span className="dot-status critical" />
                  <strong className="mono">TYPE {alert.swarm_type}</strong>
                </span>
                <span className="queue-title">{SWARM_TITLES[alert.swarm_type]}</span>
                <span className="queue-exp text-red">{formatCurrency(alert.transaction_value)}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="explorer-graph-canvas-column dossier-sheet graph-canvas-panel">
          <div className="column-title-bar">
            <span>Live graph neighborhood</span>
            <form
              className="live-account-search"
              onSubmit={event => {
                event.preventDefault();
                loadGraph(accountId);
              }}
            >
              <input
                aria-label="Account ID"
                value={accountId}
                onChange={event => setAccountId(event.target.value)}
                placeholder="ACC-000"
              />
              <button disabled={Boolean(operation)} type="submit">Load</button>
            </form>
          </div>
          <div className="canvas-wrapper-stripe" ref={containerRef}>
            {graph.nodes.length > 0 ? (
              <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
            ) : (
              <div className="node-empty-state">No graph nodes found for this account.</div>
            )}
          </div>
          <div className="live-operation-bar">
            <span>{operation || `${graph.nodes.length} nodes · ${graph.edges.length} edges`}</span>
            {lastEvent && <span>Last event: {lastEvent.event_type}</span>}
          </div>
        </main>

        <aside className="workspace-panel-column dossier-sheet live-inspector">
          <div className="column-title-bar"><span>Live evidence</span></div>
          {error && <div className="live-error-copy">{error}</div>}
          {activeAlert && (
            <section className="live-alert-summary">
              <span className="node-type-label">CONFIRMED TYPE {activeAlert.swarm_type}</span>
              <h2>{SWARM_TITLES[activeAlert.swarm_type]}</h2>
              <div className="telemetry-info-row">
                <span className="lbl">Confidence</span>
                <strong>{Math.round(activeAlert.confidence * 100)}%</strong>
              </div>
              <div className="telemetry-info-row">
                <span className="lbl">Banks</span>
                <strong>{activeAlert.bank_ids.length}</strong>
              </div>
              <div className="telemetry-info-row">
                <span className="lbl">Accounts</span>
                <strong>{activeAlert.account_ids.length}</strong>
              </div>
              <div className="live-evidence-list">
                {activeAlert.evidence.map(reason => <p key={reason}>— {reason}</p>)}
              </div>
            </section>
          )}

          {selectedNode ? (
            <div className="investigation-details animate-in">
              <header className="node-details-header">
                <span className="node-type-label">{selectedNode.type.toUpperCase()}</span>
                <h2>{selectedNode.id}</h2>
              </header>
              <section className="node-section-block">
                <h4>Graph telemetry</h4>
                <div className="telemetry-info-row">
                  <span className="lbl">Risk</span>
                  <strong>{selectedNode.risk}%</strong>
                </div>
                <div className="telemetry-info-row">
                  <span className="lbl">Bank</span>
                  <strong>{selectedNode.bank || 'Unknown'}</strong>
                </div>
              </section>
            </div>
          ) : (
            <div className="node-empty-state">Select a graph node to inspect it.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
