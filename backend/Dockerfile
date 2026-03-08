FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o bridge ./cmd/server

FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/bridge .
# If you have any static assets, copy them here
# COPY --from=builder /app/templates ./templates

EXPOSE 8040

ENTRYPOINT ["./bridge"]
