#!/bin/bash
set -euxo pipefail

dnf install -y python3.11 python3.11-pip nginx tar gzip policycoreutils

useradd --system --home-dir /opt/dhokha --shell /sbin/nologin dhokha || true
mkdir -p /opt/dhokha/backend

ARCHIVE_URL="$(printf '%s' '__ARCHIVE_URL_B64__' | base64 --decode)"
curl --fail --silent --show-error --location "$ARCHIVE_URL" --output /tmp/dhokha-backend.tar.gz
tar --extract --gzip --file /tmp/dhokha-backend.tar.gz --directory /opt/dhokha

python3.11 -m venv /opt/dhokha/venv
/opt/dhokha/venv/bin/pip install --upgrade pip
/opt/dhokha/venv/bin/pip install --requirement /opt/dhokha/backend/requirements.txt

mkdir -p /opt/dhokha/backend/data
chown -R dhokha:dhokha /opt/dhokha

cat >/etc/systemd/system/dhokha.service <<'SERVICE'
[Unit]
Description=Dhokha FastAPI fraud detection backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=dhokha
Group=dhokha
WorkingDirectory=/opt/dhokha/backend
Environment=PYTHONUNBUFFERED=1
Environment=PORT=8000
Environment=CORS_ORIGINS=*
ExecStart=/opt/dhokha/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3
TimeoutStartSec=180

[Install]
WantedBy=multi-user.target
SERVICE

cat >/etc/nginx/nginx.conf <<'NGINX'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;

    server {
        listen 80 default_server;
        server_name _;

        location / {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_read_timeout 300;
        }
    }
}
NGINX

setsebool -P httpd_can_network_connect 1 || true
nginx -t

systemctl daemon-reload
systemctl enable --now dhokha
systemctl enable --now nginx

curl --retry 20 --retry-delay 3 --retry-connrefused --fail http://127.0.0.1:8000/health
