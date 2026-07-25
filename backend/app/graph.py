from datetime import datetime, timezone
from threading import RLock
from uuid import uuid4

import networkx as nx
from sqlalchemy import select

from app.database import Account, Alert, Transaction, session_scope
from app.events import event_hub
from app.schemas import Event


class GraphEngine:
    def __init__(self):
        self.graph = nx.MultiDiGraph()
        self.lock = RLock()

    def load(self):
        graph = nx.MultiDiGraph()
        with session_scope() as db:
            for account in db.scalars(select(Account)):
                graph.add_node(account.id, node_type="account", bank_id=account.bank_id, risk=0.0)
            for txn in db.scalars(select(Transaction)):
                graph.add_edge(
                    txn.sender_account_id, txn.receiver_account_id, key=txn.id,
                    amount=txn.amount, timestamp=txn.timestamp.isoformat(), confidence=txn.confidence,
                )
        with self.lock:
            self.graph = graph

    def would_close_cycle(self, sender: str, receiver: str) -> bool:
        with self.lock:
            try:
                return nx.has_path(self.graph, receiver, sender)
            except nx.NodeNotFound:
                return False

    def chain_depth(self, account_id: str, cutoff: int = 5) -> int:
        with self.lock:
            if account_id not in self.graph:
                return 0
            lengths = nx.single_source_shortest_path_length(self.graph, account_id, cutoff=cutoff)
            return max(lengths.values(), default=0)

    async def process(self, transaction_id: str, suspected_types: list[str], reasons: list[str]):
        with session_scope() as db:
            txn = db.get(Transaction, transaction_id)
            if not txn:
                return
            sender = db.get(Account, txn.sender_account_id)
            receiver = db.get(Account, txn.receiver_account_id)
            with self.lock:
                self.graph.add_node(sender.id, node_type="account", bank_id=sender.bank_id, risk=txn.confidence)
                self.graph.add_node(receiver.id, node_type="account", bank_id=receiver.bank_id, risk=txn.confidence)
                self.graph.add_edge(
                    sender.id, receiver.id, key=txn.id, amount=txn.amount,
                    timestamp=txn.timestamp.isoformat(), confidence=txn.confidence,
                )

            event_type = "swarm_candidate" if suspected_types else "transaction_scored"
            await event_hub.publish(Event(event_type=event_type, payload={
                "transaction_id": txn.id, "sender_account_id": sender.id,
                "receiver_account_id": receiver.id, "amount": txn.amount,
                "sender_bank_id": sender.bank_id, "receiver_bank_id": receiver.bank_id,
                "timestamp": txn.timestamp.isoformat(), "confidence": txn.confidence,
                "fraud_probability": txn.fraud_probability, "rule_score": txn.rule_score,
                "decision": txn.decision, "suspected_swarm_types": suspected_types,
            }))
            if not suspected_types:
                return

            with self.lock:
                local_nodes = set([sender.id, receiver.id])
                local_nodes.update(self.graph.predecessors(receiver.id))
                local_nodes.update(self.graph.successors(sender.id))
            accounts = list(local_nodes)
            bank_ids = sorted({a.bank_id for a in db.scalars(select(Account).where(Account.id.in_(accounts)))})
            for swarm_type in suspected_types:
                alert = Alert(
                    id=f"ALT-{uuid4().hex[:12]}", swarm_type=swarm_type, status="confirmed",
                    confidence=min(0.99, max(txn.confidence, 0.86)), account_ids=sorted(accounts),
                    bank_ids=bank_ids, transaction_value=txn.amount, evidence=reasons,
                    created_at=datetime.now(timezone.utc).replace(tzinfo=None),
                    updated_at=datetime.now(timezone.utc).replace(tzinfo=None),
                )
                db.add(alert)
                db.flush()
                await event_hub.publish(Event(event_type="swarm_confirmed", payload={
                    "alert_id": alert.id, "swarm_type": swarm_type, "confidence": alert.confidence,
                    "account_ids": alert.account_ids, "bank_ids": alert.bank_ids,
                    "transaction_value": alert.transaction_value, "evidence": reasons,
                }))

    def subgraph(self, account_id: str, depth: int = 2) -> dict:
        with self.lock:
            if account_id not in self.graph:
                return {"nodes": [], "edges": []}
            nodes = {account_id}
            frontier = {account_id}
            for _ in range(depth):
                adjacent = set()
                for node in frontier:
                    adjacent.update(self.graph.predecessors(node))
                    adjacent.update(self.graph.successors(node))
                frontier = adjacent - nodes
                nodes.update(adjacent)
            sub = self.graph.subgraph(nodes)
            return {
                "nodes": [{"id": node, **attrs} for node, attrs in sub.nodes(data=True)],
                "edges": [
                    {"id": key, "source": source, "target": target, **attrs}
                    for source, target, key, attrs in sub.edges(keys=True, data=True)
                ],
            }


graph_engine = GraphEngine()
