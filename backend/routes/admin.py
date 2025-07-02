from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from core.security import get_db


router = APIRouter()


@router.get("/tables")
def list_tables(db: Session = Depends(get_db)):
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()
    return {"tables": tables}


@router.get("/tables/{table_name}")
def get_table_data(table_name: str, limit: int = 50, db: Session = Depends(get_db)):
    allowed_tables = [
        'users', 'farmer_profiles', 'individual_profiles', 'business_profiles',
        'farmer_products', 'product_unit_prices', 'carts', 'cart_items',
        'unified_orders', 'unified_order_items', 'unified_payments',
        'farmer_payments', 'notifications', 'device_tokens'
    ]

    if table_name not in allowed_tables:
        raise HTTPException(status_code=400, detail="Table not allowed")

    try:
        from sqlalchemy import MetaData, Table

        metadata = MetaData()
        table = Table(table_name, metadata, autoload_with=db.bind)

        result = db.execute(table.select().limit(limit))
        columns = result.keys()
        rows = result.fetchall()

        data = []
        for row in rows:
            data.append(dict(zip(columns, row)))

        return {
            "table": table_name,
            "count": len(data),
            "columns": list(columns),
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))