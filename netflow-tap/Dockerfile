# NetFlow Tap Container
# Runs pmacct (nfacctd in probe mode) to export NetFlow data
FROM alpine:3.19

# Install pmacct and networking tools
# pmacct is a mature, well-tested NetFlow/sFlow/IPFIX tool
RUN apk add --no-cache \
    pmacct \
    iproute2 \
    tcpdump \
    bash

# Create startup script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
