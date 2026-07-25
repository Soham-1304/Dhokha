# Dhokha

Cross-bank UPI fraud intelligence with a React investigation dashboard, a
FastAPI scoring service, ONNX inference, and graph-based swarm detection.

## Repository structure

```text
frontend/          React + Vite dashboard
backend/app/       Unified FastAPI service
backend/ml/        Trained ONNX model and offline feature tooling
backend/tests/     API, graph, rules, and model integration tests
```

## Run locally

Start the backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

The backend initializes a deterministic SQLite database automatically.

- API: http://127.0.0.1:8000
- Swagger: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health
- Persisted transaction history: http://127.0.0.1:8000/transactions

Start the frontend in another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The Vite development server proxies `/api` to `http://127.0.0.1:8000`.
Open http://localhost:5173/dashboard/scorer and submit any preset to execute
the real `backend/ml/fraud_model.onnx` artifact.

## Verify

```bash
cd backend && pytest -q
cd frontend && npm run lint && npm run build
```

## AWS container

Build from the repository root:

```bash
docker build -f backend/Dockerfile -t dhokha-backend .
docker run --rm -p 8000:8000 \
  -e CORS_ORIGINS=http://localhost:5173 \
  dhokha-backend
```

The image is suitable for ECS, App Runner, or an EC2 container runtime. It:

- bundles the ONNX artifact;
- listens on `0.0.0.0` and respects the platform `PORT`;
- exposes `/health` for load-balancer checks;
- uses CPU inference and requires no GPU;
- accepts `CORS_ORIGINS`, `DATABASE_URL`, and optional `REDIS_URL`.

For a deployed frontend, set:

```bash
VITE_API_URL=https://your-backend.example.com
```

## Low-latency AWS EC2 demo

For an always-on demo without serverless cold starts, the AWS CLI deployment
creates one `t3.micro` instance in `ap-south-1`, an encrypted 8 GB `gp3`
volume, ports 80/443 security-group rules, and a temporary S3 deployment
artifact.

```bash
AWS_PROFILE='bharath@rama' ./deploy/aws/deploy-ec2.sh
```

The script waits for `GET /health`, prints the public API and documentation
URLs, and stores non-secret resource IDs in the ignored
`.aws-deployment.env` file.

Remove every resource created by the script when the demo is over:

```bash
./deploy/aws/destroy-ec2.sh
```

EC2 public IPv4 and instance usage may consume AWS credits or incur charges.

The live demo backend uses:

- REST and Swagger: `https://api.dhokha.bharathperni.dev`
- WebSocket events: `wss://api.dhokha.bharathperni.dev/stream`

After creating an `A` record for `api.dhokha` pointing to the EC2 public IP,
install the certificate and configure Nginx:

```bash
./deploy/aws/configure-domain-tls.sh api.dhokha.bharathperni.dev
```

This installs a Let's Encrypt certificate, redirects HTTP to HTTPS, preserves
WebSocket upgrade headers, enables automatic certificate renewal, and records
the custom URLs in the ignored `.aws-deployment.env` file.

API Gateway remains an optional AWS-provided HTTP API fallback:

```bash
./deploy/aws/create-apigateway.sh
```

This creates an API Gateway HTTP proxy with an address such as
`https://api-id.execute-api.ap-south-1.amazonaws.com`. It disables API caching,
forwards all HTTP methods and query parameters, and enables browser CORS. Set
that generated address as `VITE_API_URL` when building the frontend.

Delete only the HTTPS API proxy:

```bash
./deploy/aws/destroy-apigateway.sh
```

The main `destroy-ec2.sh` command automatically deletes API Gateway and
CloudFront first when either resource exists.

SQLite is appropriate for the self-contained demo. For multiple production
replicas, configure PostgreSQL through `DATABASE_URL` and Redis through
`REDIS_URL`.
