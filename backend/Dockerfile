# syntax=docker/dockerfile:1
FROM golangci/golangci-lint:v2.15.0 AS lint-tool
FROM golang:1.27.3-bookworm AS base
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

FROM base AS dev
COPY --from=lint-tool /usr/bin/golangci-lint /usr/local/bin/golangci-lint
RUN go install github.com/air-verse/air@v1.67.4 && \
    go install github.com/pressly/goose/v3/cmd/goose@v3.29.0
COPY . .
EXPOSE 8080
CMD ["air", "-c", ".air.toml"]

FROM base AS build
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server && \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed && \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

FROM gcr.io/distroless/static-debian12:nonroot AS prod
WORKDIR /app
COPY --from=build /out/ /app/
COPY migrations /app/migrations
COPY data /app/data
USER 65532:65532
EXPOSE 8080
CMD ["/app/server"]
