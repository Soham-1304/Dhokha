import asyncio

from fastapi import WebSocket

from app.schemas import Event


class EventHub:
    def __init__(self):
        self.connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.connections.discard(websocket)

    async def publish(self, event: Event):
        stale = []
        for connection in list(self.connections):
            try:
                await connection.send_json(event.model_dump(mode="json"))
            except Exception:
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection)

    def publish_background(self, event: Event):
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.publish(event))
        except RuntimeError:
            pass


event_hub = EventHub()
