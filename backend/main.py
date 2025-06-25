from fastapi import FastAPI
from contextlib import asynccontextmanager
import os
from core.database import Base, engine
from routes import auth, product, order, browse, payment, notification
from seed_data import seed_database
from dotenv import load_dotenv


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)

    # Check if we need to seed the database (for prototype testing purposes
    db_file = "./farmlink.db"
    if not os.path.exists(db_file) or os.path.getsize(db_file) < 1024:
        print("🌱 Seeding database...")
        seed_database()
        print("✅ Database seeded successfully!")
    else:
        print("📊 Database already exists, skipping seeding")

    yield


load_dotenv()


app = FastAPI(lifespan=lifespan)


app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(product.router, prefix="/products", tags=["Products"])
app.include_router(order.router, prefix="/orders", tags=["Orders"])
app.include_router(browse.router, prefix="/browse", tags=["Browse"])
app.include_router(payment.router, prefix="/payment", tags=["Payment"])
app.include_router(notification.router, prefix="/notification", tags=["Notification"])