# Docker Bake file for building images with proper dependency ordering
# Usage: docker buildx bake

group "default" {
  targets = ["python-base", "bullseye-base", "gobgp-unified", "frr-unified", "exabgp-unified", "host-netknight", "container-manager", "monitoring"]
}

group "base" {
  targets = ["python-base", "bullseye-base"]
}

group "daemons" {
  targets = ["gobgp-unified", "frr-unified", "exabgp-unified", "host-netknight"]
}

group "services" {
  targets = ["container-manager", "monitoring"]
}

# Base images
target "python-base" {
  context = "./docker_base/python-base"
  dockerfile = "dockerfile"
  tags = ["python-base:latest"]
}

target "bullseye-base" {
  context = "./docker_base/bullseye-base"
  dockerfile = "dockerfile"
  tags = ["bullseye-base:latest"]
}

# Daemon images (depend on base images)
target "gobgp-unified" {
  context = "."
  dockerfile = "docker_base/gobgp-unified/dockerfile"
  tags = ["gobgp-unified:latest"]
  contexts = {
    python-base = "target:python-base"
  }
}

target "frr-unified" {
  context = "."
  dockerfile = "docker_base/frr-unified/dockerfile"
  tags = ["frr-unified:latest"]
  contexts = {
    bullseye-base = "target:bullseye-base"
  }
}

target "exabgp-unified" {
  context = "."
  dockerfile = "docker_base/exabgp-unified/dockerfile"
  tags = ["exabgp-unified:latest"]
  contexts = {
    python-base = "target:python-base"
  }
}

target "host-netknight" {
  context = "."
  dockerfile = "docker_base/host-netknight/dockerfile"
  tags = ["host-netknight:latest"]
  contexts = {
    python-base = "target:python-base"
  }
}

# Service images
target "container-manager" {
  context = "./api-container"
  dockerfile = "Dockerfile"
  tags = ["net_test_toy-container-manager:latest"]
}

target "monitoring" {
  context = "./api-monitoring"
  dockerfile = "Dockerfile"
  tags = ["net_test_toy-monitoring:latest"]
}
