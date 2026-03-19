#!/bin/sh
set -eu

if [ -f ./.env ]; then
  set -a
  . ./.env
  set +a
fi

: "${IMAGE_REPOSITORY:?IMAGE_REPOSITORY must be set in the environment or .env}"
PLATFORM="${PLATFORM:-linux/amd64}"

BUILD_STAMP="${BUILD_STAMP:-$(date +%Y%m%d%H%M%S)}"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  GIT_REF="$(git rev-parse --short HEAD)"
  if [ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then
    GIT_REF="${GIT_REF}-dirty"
  fi
else
  GIT_REF="$BUILD_STAMP"
fi

IMAGE_TAG="${IMAGE_TAG:-${GIT_REF}-${BUILD_STAMP}}"
BUILD_ID="${BUILD_ID:-$IMAGE_TAG}"

if docker buildx version >/dev/null 2>&1; then
  docker buildx build \
    --platform "$PLATFORM" \
    --pull \
    --build-arg "NEXT_BUILD_ID=$BUILD_ID" \
    --push \
    -t "$IMAGE_REPOSITORY:$IMAGE_TAG" \
    -t "$IMAGE_REPOSITORY:latest" \
    .
else
  docker build --pull \
    --build-arg "NEXT_BUILD_ID=$BUILD_ID" \
    -t "$IMAGE_REPOSITORY:$IMAGE_TAG" \
    -t "$IMAGE_REPOSITORY:latest" \
    .
  docker push "$IMAGE_REPOSITORY:$IMAGE_TAG"
  docker push "$IMAGE_REPOSITORY:latest"
fi

printf 'Pushed %s:%s and %s:latest (build id: %s)\n' "$IMAGE_REPOSITORY" "$IMAGE_TAG" "$IMAGE_REPOSITORY" "$BUILD_ID"
