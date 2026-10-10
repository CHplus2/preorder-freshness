# Existing Django + React application. Model bundle is a runtime mount or secure download.
FROM node:24-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -s /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim-bookworm
WORKDIR /app
COPY requirements.txt ./
COPY deploy/requirements-runtime.txt deploy/requirements-runtime.txt
RUN --mount=type=secret,id=build_ca \
    if [ -s /run/secrets/build_ca ]; then export PIP_CERT=/run/secrets/build_ca; fi; \
    pip install --no-cache-dir -r deploy/requirements-runtime.txt
COPY app.py manage.py ./
COPY backend/ backend/
COPY --from=frontend /build/frontend/dist frontend/dist
COPY deploy/start.sh deploy/start.sh
# Static collection is database-free and uses build-only settings, never production credentials.
RUN PYTHON_DOTENV_DISABLED=1 SECRET_KEY=static-build-only DATABASE_URL=sqlite:///:memory: \
    python manage.py collectstatic --noinput
ENV PYTHON_DOTENV_DISABLED=1 DEBUG=False
EXPOSE 8000
CMD ["sh", "deploy/start.sh"]
