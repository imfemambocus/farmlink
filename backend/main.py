from fastapi import FastAPI
from core.database import Base, engine
from routers import auth

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
