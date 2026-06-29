"""Pydantic request/response schemas.

These mirror docs/3_API_CONTRACTS.md verbatim. camelCase field names are
intentional: they must serialize exactly as the frontend contract expects.
"""

from typing import Literal

from pydantic import BaseModel

DocStatus = Literal["draft", "approved", "published"]


class DocumentState(BaseModel):
    id: str
    title: str
    body: str
    version: int
    status: DocStatus


class ApprovalContext(BaseModel):
    documentVersion: int
    requiredApprovers: list[str]
    currentUserRole: str


class PublishContext(BaseModel):
    dependentDocuments: list[str]
    subscribers: list[str]
    documentState: DocumentState


class VersionedPayload(BaseModel):
    """Body for /api/approve and /api/publish: the version the client was shown."""

    version: int


class MutatePayload(BaseModel):
    """Body for the dev-only mutation endpoint.

    `Literal` makes Pydantic reject unknown actions with a 422 automatically,
    so there is no manual validation branch to maintain.
    """

    action: Literal["increment_version", "change_approvers", "change_dependents"]
