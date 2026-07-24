"""Compatibility entrypoint.

The ONNX model now runs inside the unified API in ``app.main``. Keeping this
module means the old ``uvicorn ml.app1:app`` command still starts the same app.
"""

from app.main import app
