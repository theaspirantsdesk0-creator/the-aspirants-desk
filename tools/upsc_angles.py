"""Deterministic, no-cost UPSC syllabus links for current-affairs headlines.

These are generic syllabus pointers, not summaries, fact claims, or predictions.
The source article remains authoritative for event-specific details.
"""

FALLBACK_ANGLES = {
    "Polity": (
        "Potential relevance — GS Paper II / Prelims: constitutional institutions, "
        "governance, federal relations and accountability. Read the source to identify "
        "the specific institution, provision and facts; this is a syllabus link, not a prediction."
    ),
    "Economy": (
        "Potential relevance — GS Paper III / Prelims: Indian economy, growth, public "
        "finance, banking and inclusive development. Verify the article's specific figures "
        "and policy details from the original source."
    ),
    "International relations": (
        "Potential relevance — GS Paper II: bilateral and multilateral relations, "
        "international institutions and India's foreign policy. Use the source article "
        "to establish the countries, agreement and developments involved."
    ),
    "Environment": (
        "Potential relevance — GS Paper III / Prelims: biodiversity, conservation, "
        "climate change and environmental governance. Confirm the species, location, "
        "legal status and scientific details from the source."
    ),
    "Science and technology": (
        "Potential relevance — GS Paper III: science and technology, research, "
        "innovation and their applications. Read the source for the technology's "
        "actual capabilities, limitations and verified applications."
    ),
    "Internal security": (
        "Potential relevance — GS Paper III: internal security, border management, "
        "cybersecurity and organised threats. Use the source to identify the specific "
        "security issue and verified institutional response."
    ),
    "Schemes and society": (
        "Potential relevance — GS Paper II: welfare schemes, vulnerable sections, "
        "social justice and implementation challenges. Verify the scheme's eligibility, "
        "coverage and outcomes from official material."
    ),
}


def fallback_upsc_angle(topic: str) -> str:
    """Return a cautious syllabus pointer, or empty for topics too broad to classify."""
    return FALLBACK_ANGLES.get(topic, "")
