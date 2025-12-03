FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . /app/api-container

# Set Python path
ENV PYTHONPATH=/app

EXPOSE 5000

CMD ["uvicorn", "api-container.core.container_api:app", "--host", "0.0.0.0", "--port", "5000", "--reload"]
