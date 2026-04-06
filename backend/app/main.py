from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import router
from app.routes.email_routes import router as email_router
from app.routes.contract_routes import router as contract_router
from app.routes.sender_routes import router as sender_router
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="LexAgent API",
    description="Autonomous Contract Review & Creation Agent",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router,          prefix="/api")
app.include_router(email_router,    prefix="/api")
app.include_router(contract_router, prefix="/api")
app.include_router(sender_router,   prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "LexAgent"}
