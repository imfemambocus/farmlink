from fastapi import FastAPI
from core.database import Base, engine
from routers import auth, product, order, browse

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(product.router, prefix="/products", tags=["Products"])
app.include_router(order.router, prefix="/orders", tags=["Orders"])
app.include_router(browse.router, prefix="/browse", tags=["Browse"])

