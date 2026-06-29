# API Contracts & WebSocket Protocol

## Document State Shape
{
  "id": "doc-1",
  "title": "Engineering Proposal",
  "body": "This document outlines the architecture...",
  "version": 1,
  "status": "draft" // "draft" | "approved" | "published"
}

## REST Endpoints
1. GET `/api/approval-context`
Returns: { documentVersion: number, requiredApprovers: string[], currentUserRole: string }

2. POST `/api/approve`
Payload: { version: number }
Returns 200 OK if successful.
Returns 409 Conflict if payload version does not match current server version.

3. GET `/api/publish-context`
Returns: { dependentDocuments: string[], subscribers: string[], documentState: DocumentState }

4. POST `/api/publish`
Payload: { version: number }
Returns 200 OK if successful.
Returns 409 Conflict on version mismatch.

5. POST `/api/dev/mutate` (For testing mid-flight state changes)
Payload: { action: "increment_version" | "change_approvers" | "change_dependents" }
Forces a state change on the server and broadcasts via WebSocket.

## WebSocket Protocol
Endpoint: `ws://localhost:8000/ws`
Server pushes JSON messages when state changes:
{
  "type": "STATE_UPDATED",
  "payload": {
    "document": DocumentState,
    "approvalContextChanged": boolean,
    "publishContextChanged": boolean
  }
}