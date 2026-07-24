import sqlite3
import requests

# 1. User inputs ONLY payment details from the app
sender_id = "C123456789"
receiver_id = "M987654321"  # Or use a receiver ID present in your network_profiles.db
amount = 45000.0

print(f"📱 User initiated payment: Send ₹{amount} from {sender_id} to {receiver_id}")

# 2. Simulate Core DB Balance Lookup (In real app, backend fetches this from User DB)
oldbalanceOrg = 100000.0
newbalanceOrig = oldbalanceOrg - amount
oldbalanceDest = 0.0
newbalanceDest = 0.0

# 3. Backend looks up receiver graph metrics from network_profiles.db
print(f"🔍 Backend looking up graph metrics for receiver: {receiver_id}...")
conn = sqlite3.connect("network_profiles.db")
cursor = conn.cursor()

cursor.execute("""
    SELECT dest_in_degree, dest_out_degree, dest_pagerank, is_merchant 
    FROM account_profiles 
    WHERE account_id = ?
""", (receiver_id,))

result = cursor.fetchone()
conn.close()

# If receiver not found in historical DB, fallback to safe defaults
if result:
    dest_in_degree, dest_out_degree, dest_pagerank, is_merchant = result
    print("✅ Receiver metrics found in Database!")
else:
    print("⚠️ Receiver not in graph history, using default baseline metrics.")
    dest_in_degree, dest_out_degree, dest_pagerank = 1.0, 0.0, 0.0001
    is_merchant = 1 if receiver_id.startswith("M") else 0

# 4. Assemble the 9-parameter payload
payload = {
    "amount": amount,
    "oldbalanceOrg": oldbalanceOrg,
    "newbalanceOrig": newbalanceOrig,
    "oldbalanceDest": oldbalanceDest,
    "newbalanceDest": newbalanceDest,
    "dest_in_degree": float(dest_in_degree),
    "dest_out_degree": float(out_degree := dest_out_degree if 'dest_out_degree' in locals() else 0.0),
    "dest_pagerank": float(dest_pagerank),
    "is_merchant": int(is_merchant)
}

print("\n🚀 Sending Enriched Payload to ML API (/v1/evaluate)...")

# 5. Send POST request to your running FastAPI server
response = requests.post("http://127.0.0.1:8000/v1/evaluate", json=payload)

# 6. Display Output Decision
if response.status_code == 200:
    data = response.json()
    print("\n--- 🎯 RESULT RECEIVED FROM ML ENGINE ---")
    print(f"Risk Score : {data['fraud_risk_score']} / 100")
    print(f"Risk Tier  : {data['risk_tier']}")
    print(f"Latency    : {data['performance']['latency_ms']} ms")
    
    # Action Trigger
    tier = data['risk_tier']
    if tier == "LOW":
        print("\n🟢 BACKEND ACTION: Payment Approved Instantly!")
    elif tier == "MEDIUM":
        print("\n🟡 BACKEND ACTION: Prompt User for UPI PIN / OTP Verification.")
    else:
        print("\n🔴 BACKEND ACTION: High Risk! Trigger Biometric Scan (Fingerprint/FaceID).")
else:
    print("❌ Error calling ML API:", response.text)