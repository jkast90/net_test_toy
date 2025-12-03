FROM python:3.11-slim

WORKDIR /app

# Install build dependencies for grpcio and docker CLI
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && curl -fsSL https://get.docker.com -o get-docker.sh \
    && sh get-docker.sh \
    && rm get-docker.sh \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy PyGoBGP library (needed by gobgp backend)
COPY PyGoBGP /app/PyGoBGP
RUN cd /app/PyGoBGP && pip install --no-cache-dir -e .

# Copy the entire api-routing package structure
COPY . /app/api-routing/

# Set environment variables
ENV DEFAULT_BGP_BACKEND=gobgp
ENV PORT=5000
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

EXPOSE 5000

# Run the unified API using python module syntax
WORKDIR /app
CMD ["python3", "-m", "api-routing.unified_bgp_api"]
