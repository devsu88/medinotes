import os
from fastapi import FastAPI, Depends  # type: ignore
from fastapi.responses import StreamingResponse  # type: ignore
from pydantic import BaseModel  # type: ignore
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials  # type: ignore
from openai import OpenAI  # type: ignore

app = FastAPI()
clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)


class Visit(BaseModel):
    patient_name: str
    date_of_visit: str
    notes: str
    specialty: str = "General Practice"
    urgency: str = "routine"


def get_system_prompt(specialty: str, urgency: str) -> str:
    base_instructions = """You are an expert medical AI assistant provided with notes written by a doctor from a patient's visit.
Your job is to summarize the visit for the doctor and provide clear action items and patient communication.
Reply with EXACTLY three sections with these exact headings:
### Summary of visit for the doctor's records
### Next steps for the doctor
### Draft of email to patient in patient-friendly language"""

    specialties = {
        "cardiology": "Focus sharply on cardiac symptoms, cardiovascular risk factors, hemodynamic stability, and relevant diagnostic tests (e.g., ECG, echocardiogram, cardiac enzymes).",
        "pediatrics": "Emphasize developmental milestones, growth percentiles, parental counseling, and use extremely warm, empathetic, child-friendly language in patient and parent communications.",
        "psychiatry": "Include comprehensive mental status observation, cognitive/affective symptoms, behavioral health considerations, coping techniques, and empathetic support resources.",
        "dermatology": "Focus on lesion morphology, anatomical distribution, history of skin changes, triggers, sun protection advice, and clear topical skincare regimens.",
        "orthopedics": "Emphasize musculoskeletal examination findings, range of motion, neurovascular status, weight-bearing limitations, physical therapy milestones, and clear pain management instructions.",
        "General Practice": "Provide a comprehensive, well-rounded holistic primary care evaluation, lifestyle recommendations, and preventative screening advice."
    }

    urgency_instructions = {
        "routine": "Treat this as a standard routine consultation or scheduled follow-up checkup.",
        "urgent": "Highlight urgent diagnostic follow-ups, prioritizing immediate interventions and clear timelines. Emphasize early warning signs that require rapid medical re-evaluation.",
        "emergency": "CRITICAL / EMERGENCY ALERT: Strongly highlight immediate red flags, emergency department (ED) referral protocols, and instruct the patient explicitly on ER escalation or calling emergency services if symptoms worsen!"
    }

    spec_note = specialties.get(specialty, specialties["General Practice"])
    urg_note = urgency_instructions.get(urgency.lower(), urgency_instructions["routine"])

    return f"{base_instructions}\n\n[Specialty Focus - {specialty}]: {spec_note}\n[Urgency Protocol - {urgency.upper()}]: {urg_note}"


def user_prompt_for(visit: Visit) -> str:
    return f"""Create the summary, next steps and draft email for:
Patient Name: {visit.patient_name}
Date of Visit: {visit.date_of_visit}
Specialty: {visit.specialty}
Urgency Level: {visit.urgency}
Notes:
{visit.notes}"""


@app.post("/api")
def consultation_summary(
    visit: Visit,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    user_id = creds.decoded["sub"]  # Available for tracking/auditing
    client = OpenAI()

    user_prompt = user_prompt_for(visit)
    system_prompt_content = get_system_prompt(visit.specialty, visit.urgency)

    prompt = [
        {"role": "system", "content": system_prompt_content},
        {"role": "user", "content": user_prompt},
    ]


    stream = client.chat.completions.create(
        model="gpt-5-nano",
        messages=prompt,
        stream=True,
    )

    def event_stream():
        for chunk in stream:
            text = chunk.choices[0].delta.content
            if text:
                lines = text.split("\n")
                for line in lines[:-1]:
                    yield f"data: {line}\n\n"
                    yield "data:  \n"
                yield f"data: {lines[-1]}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")