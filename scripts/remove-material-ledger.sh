#!/usr/bin/env bash
set -Eeuo pipefail

readonly MATERIAL_SOURCE_DIR="/opt/aigory/app"
readonly MATERIAL_DATA_DIR="/mnt/data/aigory"
readonly EXPECTED_CONTAINER_PREFIX="aigory-prod-"
readonly REQUIRED_CONFIRMATION="DELETE_AIGORY_MATERIAL_DATA"

mapfile -t material_containers < <(
  docker ps -a --format '{{.Names}}' | awk -v prefix="$EXPECTED_CONTAINER_PREFIX" 'index($0, prefix) == 1'
)

echo "Material workload deletion manifest"
printf '  source: %s\n' "$MATERIAL_SOURCE_DIR"
printf '  data:   %s\n' "$MATERIAL_DATA_DIR"
printf '  containers:\n'
printf '    %s\n' "${material_containers[@]:-(none)}"
du -sh "$MATERIAL_SOURCE_DIR" "$MATERIAL_DATA_DIR" 2>/dev/null || true

if [[ "${1:-}" != "--execute" ]]; then
  echo "Read-only manifest complete. Pass --execute to perform deletion."
  exit 0
fi

if [[ "${CONFIRM_DELETE_MATERIAL_DATA:-}" != "$REQUIRED_CONFIRMATION" ]]; then
  echo "Refusing deletion: set CONFIRM_DELETE_MATERIAL_DATA=$REQUIRED_CONFIRMATION" >&2
  exit 2
fi

for target in "$MATERIAL_SOURCE_DIR" "$MATERIAL_DATA_DIR"; do
  case "$target" in
    /opt/aigory/app|/mnt/data/aigory) ;;
    *) echo "Unexpected destructive target: $target" >&2; exit 3 ;;
  esac
done

declare -a material_images=()
if ((${#material_containers[@]} > 0)); then
  mapfile -t material_images < <(
    docker inspect --format '{{.Image}}' "${material_containers[@]}" | sort -u
  )
  docker rm -f "${material_containers[@]}"
fi

mapfile -t material_volumes < <(
  docker volume ls -q --filter label=com.docker.compose.project=aigory-prod
)
if ((${#material_volumes[@]} > 0)); then
  docker volume rm "${material_volumes[@]}"
fi

mapfile -t material_networks < <(
  docker network ls --format '{{.Name}}' | awk '$0 == "aigory-prod_default" || $0 == "aigory-prod-network"'
)
if ((${#material_networks[@]} > 0)); then
  docker network rm "${material_networks[@]}"
fi

if ((${#material_images[@]} > 0)); then
  docker image rm "${material_images[@]}" 2>/dev/null || true
fi

sudo rm -rf -- "$MATERIAL_SOURCE_DIR" "$MATERIAL_DATA_DIR"

echo "Material workload and data were permanently deleted. No backup was created."
