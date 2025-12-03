FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy monitoring code
COPY . /app/api-monitoring

# Set Python path
ENV PYTHONPATH=/app

# Expose ports
EXPOSE 11019 2055/udp 5002 5003

CMD ["python3", "/app/api-monitoring/main.py"]
