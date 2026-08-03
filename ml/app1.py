# This is the changed code of the version from the BLOCK_TRANSACTION to the score
import time
import numpy as np
import onnxruntime as rt
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

# 1. Initialize FastAPI Application
app = FastAPI(
    title="Enterprise Real-Time UPI Risk Scoring Engine",
    description="Production-grade continuous risk evaluation engine returning 0-100 hazard scores.",
    version="2.0.0"
)

# 2. Load the Optimized ONNX Inference Session
try:
    onnx_session = rt.InferenceSession("fraud_model.onnx")
    input_name = onnx_session.get_inputs()[0].name
    output_names = [out.name for out in onnx_session.get_outputs()]
except Exception as e:
    raise RuntimeError(f"Failed to load ONNX runtime model: {str(e)}")

# 3. Define Input JSON Payload
class TransactionPayload(BaseModel):
    amount: float = Field(..., example=85000.0)
    oldbalanceOrg: float = Field(..., example=120000.0)
    newbalanceOrig: float = Field(..., example=35000.0)
    oldbalanceDest: float = Field(..., example=0.0)
    newbalanceDest: float = Field(..., example=0.0)
    dest_in_degree: float = Field(..., example=45.0)
    dest_out_degree: float = Field(..., example=12.0)
    dest_pagerank: float = Field(..., example=0.0024)
    is_merchant: int = Field(..., example=0)

@app.get("/", tags=["Root"])
async def root():
    return {
        "engine_status": "ONLINE",
        "api_version": "2.0.0",
        "interactive_documentation": "/docs"
    }

# 4. Define the Scoring Endpoint
@app.post(
    "/v1/evaluate", 
    status_code=status.HTTP_200_OK,
    summary="Generate continuous risk metrics for a transaction."
)
async def evaluate_transaction(payload: TransactionPayload):
    start_processing_time = time.perf_counter()
    
    try:
        # A. Feature Engineering Guardrails
        error_balance_orig = payload.oldbalanceOrg - payload.amount - payload.newbalanceOrig
        error_balance_dest = payload.oldbalanceDest + payload.amount - payload.newbalanceDest
        
        # B. Construct the exact 11-column array
        feature_vector = np.array([[
            payload.amount,
            payload.oldbalanceOrg,
            payload.newbalanceOrig,
            payload.oldbalanceDest,
            payload.newbalanceDest,
            payload.dest_in_degree,
            payload.dest_out_degree,
            payload.dest_pagerank,
            payload.is_merchant,
            error_balance_orig,
            error_balance_dest
        ]], dtype=np.float32)
        
        # C. Execute inference via ONNX
        raw_outputs = onnx_session.run(output_names, {input_name: feature_vector})
        
        # Extract probability
        if len(raw_outputs) > 1 and isinstance(raw_outputs[1], list):
            prob = float(raw_outputs[1][0][1])
        else:
            probabilities = raw_outputs[1] if len(raw_outputs) > 1 else raw_outputs[0]
            prob = float(probabilities[0][1]) if len(probabilities.shape) > 1 else float(probabilities[0])
        
        # --- NEW: Convert Probability to an Enterprise Risk Score (0 - 100) ---
        fraud_risk_score = round(prob * 100, 2)
        
        # --- NEW: Determine Risk Tier ---
        if fraud_risk_score < 30.0:
            risk_tier = "LOW"
        elif fraud_risk_score < 75.0:
            risk_tier = "MEDIUM"
        else:
            risk_tier = "HIGH"
            
        # D. Performance speed counter
        total_latency_ms = (time.perf_counter() - start_processing_time) * 1000
        
        # E. Output JSON Scheme exactly matching your requirements
        return {
            "status": "success",
            "fraud_risk_score": fraud_risk_score,
            "risk_tier": risk_tier,
            "performance": {
                "latency_ms": round(total_latency_ms, 2),
                "sla_compliance": total_latency_ms < 200.0
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Inference pipeline execution failure: {str(e)}"
        )