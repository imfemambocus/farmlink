from fastapi import FastAPI
from contextlib import asynccontextmanager
import os
from core.database import Base, engine, SessionLocal
from routes import auth, product, order, browse, payment, notification
from seed_data import seed_database
from dotenv import load_dotenv
from sqlalchemy import text


load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 FastAPI lifespan startup beginning...")

    # Create tables first
    Base.metadata.create_all(bind=engine)
    print("📋 Database tables created/verified")

    # Check environment variable to force seeding
    force_seed = os.getenv("FORCE_SEED", "false").lower() == "true"

    if force_seed:
        print("🌱 Force seeding enabled via FORCE_SEED environment variable...")
        seed_database()
        print("✅ Database seeded successfully!")
    else:
        # Check if database is empty by counting tables with data
        db = SessionLocal()
        try:
            # Check if we have any users (indicating seeded data)
            result = db.execute(text("SELECT COUNT(*) as count FROM users"))
            user_count = result.fetchone()[0]
            print(f"👥 Found {user_count} users in database")

            if user_count == 0:
                print("🌱 Database is empty, seeding...")
                seed_database()
                print("✅ Database seeded successfully!")
            else:
                print("📊 Database already has data, skipping seeding")

        except Exception as e:
            print(f"❌ Error checking database or seeding: {e}")
            # If tables don't exist yet, seed anyway
            print("🌱 Seeding database due to error (likely empty DB)...")
            seed_database()
            print("✅ Database seeded successfully!")
        finally:
            db.close()

    print("✅ FastAPI lifespan startup completed")
    yield
    print("🛑 FastAPI lifespan shutdown")


app = FastAPI(lifespan=lifespan)

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(product.router, prefix="/products", tags=["Products"])
app.include_router(order.router, prefix="/orders", tags=["Orders"])
app.include_router(browse.router, prefix="/browse", tags=["Browse"])
app.include_router(payment.router, prefix="/payment", tags=["Payment"])
app.include_router(notification.router, prefix="/notification", tags=["Notification"])