from fastapi import FastAPI
from contextlib import asynccontextmanager
import os
from core.database import Base, engine
from routes import auth, product, order, browse, payment, notification, admin
from seed_data import seed_database
from dotenv import load_dotenv

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 FastAPI lifespan startup beginning...")

    Base.metadata.create_all(bind=engine)
    print("📋 Database tables created/verified")

    force_seed = os.getenv("FORCE_SEED", "false").lower() == "true"

    if force_seed:
        print("🌱 Force seeding enabled via FORCE_SEED environment variable...")
        seed_database()
        print("✅ Database seeded successfully!")
    else:
        print("📊 FORCE_SEED is false, skipping database seeding")

    print("✅ FastAPI lifespan startup completed")
    yield
    print("🛑 FastAPI lifespan shutdown")


app = FastAPI(lifespan=lifespan)

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(product.router, prefix="/products", tags=["Products"])
app.include_router(order.router, prefix="/orders", tags=["Orders"])
app.include_router(browse.router, prefix="/browse", tags=["Payment"])
app.include_router(payment.router, prefix="/payment", tags=["Payment"])
app.include_router(notification.router, prefix="/notification", tags=["Notification"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])